import * as THREE from './vendor/three.module.js';
import { createCompanion } from './companion-model.js';

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
  const [awakeTexture,sleepTexture,backgroundTexture]=await Promise.all(['assets/awake.jpeg','assets/sleeping.jpeg','assets/forest-background.jpeg'].map(async url=>{
    const texture=await loader.loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return texture;
  }));
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(1408/184,768/184),new THREE.MeshBasicMaterial({map:backgroundTexture,toneMapped:false}));
  backdrop.position.set((704-750)/184,314/184,-1.3);scene.add(backdrop);
  const contact=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:'#4d612b',transparent:true,opacity:.15,depthWrite:false}));
  contact.scale.set(1.15,.10,1);contact.position.set(0,.055,-.5);scene.add(contact);
  const buddy=createCompanion(THREE,{awakeTexture,sleepTexture});scene.add(buddy.group);
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
  const label=mode=>{activityLabel.textContent=mode==='walking'?'正在散步':mode==='eating'?'正在吃叶子':'正在睡觉';};
  for(let i=0;i<70;i++)buddy.update(0,.06,state);
  renderer.render(scene,camera);forest.classList.add('is-3d','reference-model');
  document.getElementById('view-hint').textContent='轻拖看立体细节';
  const frame=now=>{
    requestAnimationFrame(frame);
    const dt=Math.min((now-previous)/1000,.06);previous=now;if(document.hidden)return;
    time+=dt;if(running)activeTime+=dt;
    const cycle=activeTime%20;
    // Start with the reference pose, then waddle and nibble without changing identity.
    state.mode=running?(cycle<3?'eating':cycle<12?'walking':'eating'):'sleeping';
    if(reduced&&running)state.mode='eating';
    if(lastMode!==state.mode){lastMode=state.mode;buddy.setActivity?.(state.mode);label(state.mode);}
    const smooth=1-Math.exp(-dt*4);
    const travel=state.mode==='walking'?Math.sin((cycle-3)*.75)*.42:0;
    moveX=THREE.MathUtils.lerp(moveX,travel,smooth);
    yaw=THREE.MathUtils.lerp(yaw,state.mode==='walking'?Math.cos((cycle-3)*.75)*.055:0,smooth);
    buddy.group.position.x=moveX;buddy.group.rotation.y=yaw;
    buddy.update(reduced?0:time,dt,state);
    contact.position.x=moveX;contact.scale.x=1.15+(running?0:.02*Math.sin(time*1.6));
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
