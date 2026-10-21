import * as THREE from './vendor/three.module.js';
import { createCompanion } from './companion-model.js';
import { createSnowfall, createPenguin } from './winter-scene.js';

const forest=document.getElementById('forest');
const mount=document.getElementById('world-3d');
const activityLabel=document.getElementById('activity-label');
let renderer;

async function initialize(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;
  const canvas=renderer.domElement;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','原图森林伙伴：带立体厚度的原画角色，学习时散步、吃叶子，暂停时睡觉');
  mount.appendChild(canvas);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bee0db');
  const camera=new THREE.OrthographicCamera(-4,4,3.8,-.4,.1,30);
  const target=new THREE.Vector3(0,314/184,0);
  camera.position.set(0,target.y,8);camera.lookAt(target);
  scene.add(new THREE.HemisphereLight('#fff3da','#8c745a',1.8));
  const key=new THREE.DirectionalLight('#ffeed7',1.1);key.position.set(-3,5,6);scene.add(key);
  const loader=new THREE.TextureLoader();
  const [awakeTexture,sleepTexture,backgroundTexture]=await Promise.all(['assets/awake.jpeg','assets/sleeping.jpeg','assets/golden-forest.jpeg'].map(async url=>{
    const texture=await loader.loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return texture;
  }));
  const backdropMaterial=new THREE.MeshBasicMaterial({map:backgroundTexture,toneMapped:false});
  // 季节只改背景色调：袋熊保持原色。原图是夏天，其余季节在着色器里调色相、饱和度和雪色。
  const SEASON_LOOKS={spring:[.06,.9,1.1,0],summer:[0,1,1,0],autumn:[-.2,1.35,1.02,0],winter:[0,1,1,0]};
  const seasonUniform={value:new THREE.Vector4(...SEASON_LOOKS.summer)},seasonTarget=seasonUniform.value.clone();
  backdropMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uSeason=seasonUniform;
    shader.fragmentShader='uniform vec4 uSeason;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 c=diffuseColor.rgb;vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 P=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 Q=mix(vec4(P.xyw,c.r),vec4(c.r,P.yzx),step(P.x,c.r));
      float d=Q.x-min(Q.w,Q.y);vec3 hsv=vec3(abs(Q.z+(Q.w-Q.y)/(6.*d+1e-10)),d/(Q.x+1e-10),Q.x);
      float greenish=smoothstep(.12,.2,hsv.x)*(1.-smoothstep(.42,.5,hsv.x));hsv.x=fract(hsv.x+uSeason.x*greenish);hsv.y=clamp(hsv.y*mix(1.,uSeason.y,greenish*.6+.4),0.,1.);
      vec3 rgb=hsv.z*mix(vec3(1.),clamp(abs(fract(hsv.x+vec3(1.,2./3.,1./3.))*6.-3.)-1.,0.,1.),hsv.y)*uSeason.z;
      diffuseColor.rgb=mix(rgb,vec3(.93,.96,1.),uSeason.w*smoothstep(.35,.9,hsv.z));`);
  };
  const applySeason=season=>seasonTarget.set(...(SEASON_LOOKS[season]||SEASON_LOOKS.summer));
  applySeason(forest.dataset.season);seasonUniform.value.copy(seasonTarget);
  document.addEventListener('season:change',event=>applySeason(event.detail.season));
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry((768/184)*(1586/992),768/184),backdropMaterial);
  backdrop.position.set(0,314/184,-1.3);scene.add(backdrop);
  // 冬天使用单独绘制的雪景背景，并叠加飘雪，切换季节时淡入淡出。
  const winterMaterial=new THREE.MeshBasicMaterial({toneMapped:false,transparent:true,opacity:0,depthWrite:false});
  const winterBackdrop=new THREE.Mesh(backdrop.geometry,winterMaterial);winterBackdrop.position.set(0,314/184,-1.29);scene.add(winterBackdrop);
  const snow=createSnowfall(THREE,{width:(768/184)*(1586/992)*1.6,height:768/184+.4,centerY:314/184});scene.add(snow.points);
  const isWinter=()=>forest.dataset.season==='winter';
  // 冬天的雪景图和小企鹅序列帧在第一次切到冬天时才加载。
  let penguin=null,winterLoading=null;
  const loadWinter=()=>winterLoading||=Promise.all(['assets/winter-forest.jpeg','assets/penguin-walk.webp'].map(url=>loader.loadAsync(url))).then(([background,sheet])=>{
    for(const texture of [background,sheet]){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);}
    winterMaterial.map=background;winterMaterial.needsUpdate=true;
    penguin=createPenguin(THREE,sheet);penguin.setFrame(0);scene.add(penguin.mesh);
  }).catch(error=>console.warn('Winter scene unavailable',error));
  if(isWinter())loadWinter();
  document.addEventListener('season:change',event=>{if(event.detail.season==='winter')loadWinter();});
  winterMaterial.opacity=snow.material.opacity=0;
  const contact=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:'#4d612b',transparent:true,opacity:.15,depthWrite:false}));
  contact.scale.set(1.15,.10,1);contact.position.set(0,.055,-.5);scene.add(contact);
  const buddy=createCompanion(THREE,{awakeTexture,sleepTexture});buddy.group.scale.setScalar(.92);buddy.group.position.x=-.12;scene.add(buddy.group);
  let running=forest.dataset.state==='running';
  let activeTime=0,time=0,previous=performance.now(),lastMode='';
  let moveX=0,yaw=0,orbit=0,tilt=0,dragging=false,lastX=0,lastY=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={mode:running?'eating':'sleeping',phase:1,speed:1};
  const updateCamera=()=>{camera.position.set(Math.sin(orbit)*8,target.y+tilt,Math.cos(orbit)*8);camera.lookAt(target);};
  const resize=()=>{
    const w=Math.max(mount.clientWidth,1),h=Math.max(mount.clientHeight,1),span=768/184;
    camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  };
  new ResizeObserver(resize).observe(mount);resize();
  canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(!dragging)return;
    orbit=THREE.MathUtils.clamp(orbit+(e.clientX-lastX)*.0025,-.20,.20);
    tilt=THREE.MathUtils.clamp(tilt+(e.clientY-lastY)*.002,-.15,.15);
    lastX=e.clientX;lastY=e.clientY;updateCamera();
  });
  const release=()=>dragging=false;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  document.addEventListener('study:state',event=>{const next=event.detail.status==='running';if(next&&!running)activeTime=0;running=next;});
  const label=mode=>{activityLabel.textContent=mode==='walking'?'散步中':mode==='eating'?(isWinter()?'玩雪中':'吃叶子'):'休息中';};
  for(let i=0;i<70;i++)buddy.update(0,.06,state);
  renderer.render(scene,camera);forest.classList.add('is-3d','reference-model');
  document.getElementById('view-hint').textContent='轻拖看立体细节';
  const frame=now=>{
    requestAnimationFrame(frame);
    const dt=Math.min((now-previous)/1000,.06);previous=now;if(document.hidden||!mount.clientWidth||!mount.clientHeight)return;
    time+=dt;if(running)activeTime+=dt;
    const cycle=activeTime%20;
    // Start with the reference pose, then waddle and nibble without changing identity.
    state.mode=running?(cycle<3?'eating':cycle<12?'walking':'eating'):'sleeping';
    if(reduced&&running)state.mode='eating';
    if(lastMode!==state.mode){lastMode=state.mode;buddy.setActivity?.(state.mode);label(state.mode);}
    const smooth=1-Math.exp(-dt*4);
    seasonUniform.value.lerp(seasonTarget,reduced?1:1-Math.exp(-dt*3));
    const winterFade=reduced?1:1-Math.exp(-dt*3),winterGoal=isWinter()&&penguin?1:0;
    winterMaterial.opacity+=(winterGoal-winterMaterial.opacity)*winterFade;snow.material.opacity=winterMaterial.opacity*.95;
    winterBackdrop.visible=snow.points.visible=winterMaterial.opacity>.01;
    // 冬天由小企鹅陪伴：散步时播放 Blender 里的走路动画，其余时间站着轻轻呼吸、开心地蹦一下。
    buddy.group.visible=winterMaterial.opacity<.5;
    if(penguin){
      penguin.material.opacity=winterMaterial.opacity;penguin.mesh.visible=!buddy.group.visible;
      const walking=state.mode==='walking'&&!reduced,sleeping=state.mode==='sleeping';
      penguin.setFrame(walking?Math.floor(time*24):0);
      const breath=reduced?0:Math.sin(time*(sleeping?1.4:2.2))*(sleeping?.018:.012);
      const hop=state.mode==='eating'&&!reduced?Math.max(0,Math.sin(time*5))*.05:0;
      penguin.mesh.position.set(buddy.group.position.x,hop,0);
      penguin.mesh.scale.set(1-breath*.5,1+breath,1);penguin.mesh.rotation.z=sleeping&&!reduced?Math.sin(time*.7)*.03:0;
    }
    if(snow.points.visible&&!reduced)snow.update(dt,time);
    const travel=state.mode==='walking'?Math.sin((cycle-3)*.75)*.42:0;
    moveX=THREE.MathUtils.lerp(moveX,travel,smooth);
    yaw=THREE.MathUtils.lerp(yaw,state.mode==='walking'?Math.cos((cycle-3)*.75)*.055:0,smooth);
    buddy.group.position.x=moveX-.12;buddy.group.rotation.y=yaw;
    buddy.update(reduced?0:time,dt,state);
    contact.position.x=moveX-.12;contact.scale.x=1.15+(running?0:.02*Math.sin(time*1.6));
    if(!dragging&&(Math.abs(orbit)>.0001||Math.abs(tilt)>.0001)){orbit=THREE.MathUtils.lerp(orbit,0,smooth*.35);tilt=THREE.MathUtils.lerp(tilt,0,smooth*.35);updateCamera();}
    renderer.render(scene,camera);
    mount.dataset.activity=state.mode;mount.dataset.motionTime=time.toFixed(2);
    mount.dataset.drawCalls=renderer.info.render.calls;mount.dataset.triangles=renderer.info.render.triangles;
    mount.dataset.geometries=renderer.info.memory.geometries;mount.dataset.textures=renderer.info.memory.textures;
    mount.dataset.appearance='original-image-texture';
  };
  requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();forest.classList.remove('is-3d');activityLabel.textContent='画面暂不可用';});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
}
initialize().catch(error=>{
  renderer?.dispose();mount.replaceChildren();
  document.getElementById('view-hint').textContent='当前设备使用原图模式';
  activityLabel.textContent='原图伙伴';console.warn('Companion initialization unavailable',error);
});
