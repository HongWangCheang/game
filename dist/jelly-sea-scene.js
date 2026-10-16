/**
 * 果冻海：半透明果冻水母在海里漂浮的 Three.js 场景。
 * 只负责画面；学习状态通过 setStatus() 传入，不读写任何计时数据。
 */
export function createJellySea(THREE, { mount, reduced = false } = {}) {
  if (!mount) throw new Error('createJellySea requires mount');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '果冻海：半透明的果冻水母在海里漂浮，学习时游动发光，暂停时静静休息');
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b7f93');
  scene.fog = new THREE.Fog('#3a8ea0', 9, 22);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 1.1, 0);
  let orbit = 0, tilt = 0, dragging = false, lastX = 0, lastY = 0;
  const updateCamera = () => {
    camera.position.set(Math.sin(orbit) * 9, target.y + 0.35 + tilt * 3, Math.cos(orbit) * 9);
    camera.lookAt(target);
  };
  updateCamera();

  const disposables = [];
  const keep = item => (disposables.push(item), item);
  const uniforms = { uTime: { value: 0 }, uAwake: { value: 0 } };

  // 海水背景：上亮下深的渐变 + 摇晃的光柱。
  const water = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(40, 22)),
    keep(new THREE.ShaderMaterial({
      uniforms,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform float uTime;uniform float uAwake;varying vec2 vUv;
        void main(){
          vec3 deep=vec3(.075,.30,.40),mid=vec3(.20,.56,.62),top=vec3(.70,.93,.90);
          float y=vUv.y;
          vec3 c=mix(deep,mid,smoothstep(.05,.55,y));
          c=mix(c,top,smoothstep(.55,1.,y));
          float x=vUv.x+(1.-y)*.18;
          float rays=0.;
          rays+=pow(max(sin(x*38.+sin(uTime*.35)*1.6),0.),9.);
          rays+=.7*pow(max(sin(x*23.-uTime*.22+1.7),0.),11.);
          rays+=.5*pow(max(sin(x*57.+uTime*.18+.4),0.),14.);
          c+=vec3(.95,1.,.88)*rays*smoothstep(.15,1.,y)*(.10+.12*uAwake);
          c+=vec3(1.,.97,.82)*smoothstep(.72,1.,y)*.10*(.6+.4*uAwake);
          gl_FragColor=vec4(c,1.);
        }`,
    })),
  );
  water.position.set(0, 3.5, -12);
  scene.add(water);

  // 沙地：带焦散光纹的柔软海床。
  const sandGeometry = keep(new THREE.PlaneGeometry(40, 18, 60, 30));
  const sandPosition = sandGeometry.attributes.position;
  for (let i = 0; i < sandPosition.count; i++) {
    const x = sandPosition.getX(i), y = sandPosition.getY(i);
    sandPosition.setZ(i, Math.sin(x * .45) * .18 + Math.cos(y * .6 + x * .2) * .14);
  }
  sandGeometry.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeometry, keep(new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    vertexShader: 'varying vec2 vUv;varying float vH;void main(){vUv=uv;vH=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform float uTime;uniform float uAwake;varying vec2 vUv;varying float vH;
      float caustic(vec2 p){
        float v=0.;
        for(int i=0;i<3;i++){
          float fi=float(i);
          p+=vec2(sin(p.y*1.7+uTime*.6+fi),cos(p.x*1.3-uTime*.5+fi*1.7))*.35;
          v+=abs(sin(p.x*2.1+p.y*1.3));
        }
        return pow(1.-v/3.,6.);
      }
      void main(){
        vec3 sandC=vec3(.93,.84,.66);
        vec3 c=mix(sandC*.62,sandC,smoothstep(.05,.9,vUv.y)*.6+.4*vH);
        c+=vec3(1.,.98,.85)*caustic(vUv*vec2(26.,12.))*(.28+.25*uAwake);
        vec3 haze=vec3(.24,.55,.62);
        c=mix(c,haze,smoothstep(.55,1.,vUv.y)*.85);
        gl_FragColor=vec4(c,1.);
      }`,
  })));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -1.15, -4);
  scene.add(sand);

  scene.add(new THREE.HemisphereLight('#e9fff8', '#365d63', 1.5));
  const sun = new THREE.DirectionalLight('#fff6dc', 1.2);
  sun.position.set(-3, 8, 5);
  scene.add(sun);

  // 摇摆的海草。
  const weedMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      uniform float uTime;attribute float aSeed;varying float vT;varying float vSeed;
      void main(){
        vec3 p=position;float t=uv.y;vT=t;vSeed=aSeed;
        p.x+=sin(t*3.2+uTime*1.1+aSeed*6.)*.32*t*t;
        p.z+=cos(t*2.6+uTime*.8+aSeed*4.)*.12*t;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      varying float vT;varying float vSeed;
      void main(){
        vec3 a=mix(vec3(.16,.45,.34),vec3(.32,.55,.30),vSeed);
        vec3 b=mix(vec3(.55,.82,.55),vec3(.70,.86,.48),vSeed);
        gl_FragColor=vec4(mix(a,b,vT),1.);
      }`,
  }));
  const addWeed = (x, z, h, w, seed) => {
    const geometry = keep(new THREE.PlaneGeometry(w, h, 1, 18));
    geometry.translate(0, h / 2, 0);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const t = position.getY(i) / h;
      position.setX(i, position.getX(i) * (1 - t * .85));
    }
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(position.count).fill(seed), 1));
    const weed = new THREE.Mesh(geometry, weedMaterial);
    weed.position.set(x, -1.2, z);
    weed.rotation.y = (seed - .5) * 1.2;
    scene.add(weed);
  };
  [[-4.6, -1.2, 2.6, .34, .1], [-4.25, -1.6, 3.4, .30, .55], [-3.8, -.9, 1.9, .26, .8],
    [4.1, -1.4, 3.0, .32, .3], [4.6, -1.0, 2.2, .28, .9], [3.7, -2.2, 3.8, .36, .65],
    [-1.8, -4.5, 2.4, .3, .4], [2.1, -5.2, 2.8, .3, .2], [-6.2, -3.0, 3.6, .4, .75], [6.3, -3.4, 3.3, .4, .15]]
    .forEach(args => addWeed(...args));

  // 珊瑚和鹅卵石：圆润柔软的小块体。
  const roundMaterials = ['#f7a6a0', '#ffc98f', '#c9a3e8', '#ffe0b8', '#9fd6c7'].map(color =>
    keep(new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: 0 })));
  const ball = keep(new THREE.SphereGeometry(1, 24, 16));
  [[-3.3, -1.0, .55, 0], [-2.85, -1.6, .34, 1], [3.3, -1.1, .48, 2], [2.8, -.6, .3, 3],
    [-5.2, -2.2, .7, 4], [5.4, -2.0, .62, 0], [.9, -3.6, .4, 3], [-1.1, -3.0, .32, 1]]
    .forEach(([x, z, r, m]) => {
      const pebble = new THREE.Mesh(ball, roundMaterials[m]);
      pebble.scale.set(r * 1.15, r * .72, r);
      pebble.position.set(x, -1.18 + r * .3, z);
      scene.add(pebble);
    });
  // 粉色小珊瑚枝。
  const coralGeometry = keep(new THREE.CapsuleGeometry(.08, .55, 6, 12));
  const addCoral = (x, z, color) => {
    const group = new THREE.Group();
    const material = keep(new THREE.MeshStandardMaterial({ color, roughness: .5 }));
    [[0, .32, 0, 0], [-.16, .5, .1, .5], [.17, .46, -.05, -.55], [.05, .72, .05, -.15]].forEach(([bx, by, bz, rz]) => {
      const branch = new THREE.Mesh(coralGeometry, material);
      branch.position.set(bx, by, bz);
      branch.rotation.z = rz;
      group.add(branch);
    });
    group.position.set(x, -1.2, z);
    scene.add(group);
  };
  addCoral(-3.6, -1.9, '#ff8f9a');
  addCoral(3.85, -2.6, '#ffae7a');
  addCoral(-.6, -6.5, '#e8a0e0');

  // 果冻水母：伞盖、内核、触须和口腕都在着色器里形变，CPU 只更新位置。
  const bellVertex = `
    uniform float uTime;uniform float uBeat;uniform float uPhase;uniform float uPulse;
    varying vec3 vN;varying vec3 vView;varying float vH;
    void main(){
      vec3 p=position;
      float h=clamp(p.y,0.,1.);
      float rim=1.-h;
      float squeeze=(.5+.5*sin(uBeat+uPhase))*uPulse;
      p.xz*=1.-.17*squeeze*rim;
      p.y*=1.+.10*squeeze;
      p.y+=.045*sin(atan(p.z,p.x)*8.+uTime*1.8+uPhase)*rim*rim;
      vH=h;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vN=normalize(normalMatrix*normal);
      vView=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv;
    }`;
  const bellFragment = `
    uniform vec3 uColor;uniform vec3 uRim;uniform float uGlow;uniform float uOpacity;
    varying vec3 vN;varying vec3 vView;varying float vH;
    void main(){
      vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
      float facing=abs(dot(n,normalize(vView)));
      float fres=pow(1.-facing,2.2);
      vec3 c=mix(uColor,uRim,fres*.85);
      c+=uRim*fres*uGlow*.55;
      c+=uColor*uGlow*.18;
      float spec=.7*smoothstep(.78,.99,dot(n,normalize(vec3(-.45,.62,.64))));
      c+=vec3(1.)*spec*.75;
      c+=vec3(1.,.98,.95)*pow(vH,5.)*.18;
      float a=clamp(uOpacity*(.38+.62*fres)+spec*.55,0.,1.);
      gl_FragColor=vec4(c,a);
    }`;
  const strandVertex = `
    uniform float uTime;uniform float uPhase;uniform float uLength;uniform float uSwing;uniform float uDrag;
    attribute float aOffset;varying float vT;
    void main(){
      vec3 p=position;
      float t=clamp(-p.y/uLength,0.,1.);vT=t;
      p.x+=sin(t*5.5-uTime*2.2+uPhase+aOffset)*.16*uSwing*t;
      p.z+=cos(t*4.3-uTime*1.7+uPhase*1.3+aOffset)*.12*uSwing*t;
      p.y+=uDrag*t*t*.35;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }`;
  const strandFragment = `
    uniform vec3 uRim;uniform float uGlow;uniform float uOpacity;varying float vT;
    void main(){
      vec3 c=uRim*(1.+uGlow*.35);
      gl_FragColor=vec4(c,uOpacity*(1.-vT*.85));
    }`;

  const tentacleGeometry = keep(new THREE.CylinderGeometry(.022, .006, 1, 5, 24, true));
  tentacleGeometry.translate(0, -.5, 0);
  const armGeometry = keep(new THREE.PlaneGeometry(.17, 1, 1, 24));
  armGeometry.translate(0, -.5, 0);
  const bellGeometry = keep(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI * .56));
  const coreGeometry = keep(new THREE.SphereGeometry(.55, 32, 16, 0, Math.PI * 2, 0, Math.PI * .5));

  const jellies = [];
  const makeJelly = ({ color, rim, size, home, phase, depth = 0, hero = false }) => {
    const shared = {
      uTime: uniforms.uTime, uBeat: { value: 0 }, uPhase: { value: phase }, uPulse: { value: 1 },
      uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) },
      uGlow: { value: 0 }, uOpacity: { value: .62 },
    };
    const group = new THREE.Group();
    const bell = new THREE.Mesh(bellGeometry, keep(new THREE.ShaderMaterial({
      uniforms: shared, vertexShader: bellVertex, fragmentShader: bellFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    })));
    bell.renderOrder = 2;
    group.add(bell);
    // 内部更实的“果冻芯”，让伞盖有一层软糖般的厚度。
    const coreUniforms = { ...shared, uColor: { value: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .35) }, uOpacity: { value: .45 } };
    const core = new THREE.Mesh(coreGeometry, keep(new THREE.ShaderMaterial({
      uniforms: coreUniforms, vertexShader: bellVertex, fragmentShader: bellFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    })));
    core.position.y = .08;
    core.renderOrder = 1;
    group.add(core);

    const strandUniforms = {
      uTime: uniforms.uTime, uPhase: shared.uPhase, uLength: { value: 1 }, uSwing: { value: 1 }, uDrag: { value: 0 },
      uRim: shared.uRim, uGlow: shared.uGlow, uOpacity: { value: .75 },
    };
    const strandMaterial = keep(new THREE.ShaderMaterial({
      uniforms: strandUniforms, vertexShader: strandVertex, fragmentShader: strandFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    const tentacleCount = hero ? 12 : 9;
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const length = 1.5 + (i % 3) * .35;
      const geometry = tentacleGeometry.clone();
      geometry.scale(1, length, 1);
      geometry.setAttribute('aOffset', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(angle * 1.7), 1));
      keep(geometry);
      const strand = new THREE.Mesh(geometry, strandMaterial);
      strand.position.set(Math.cos(angle) * .78, -.05, Math.sin(angle) * .78);
      group.add(strand);
    }
    const armUniforms = { ...strandUniforms, uOpacity: { value: .55 }, uRim: { value: new THREE.Color(rim).lerp(new THREE.Color(color), .45) } };
    const armMaterial = keep(new THREE.ShaderMaterial({
      uniforms: armUniforms, vertexShader: strandVertex, fragmentShader: strandFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    for (let i = 0; i < 4; i++) {
      const geometry = armGeometry.clone();
      geometry.scale(1, 1.1 + (i % 2) * .25, 1);
      geometry.setAttribute('aOffset', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(i * 2.1), 1));
      keep(geometry);
      const arm = new THREE.Mesh(geometry, armMaterial);
      arm.position.set(Math.cos(i * 1.57) * .14, .02, Math.sin(i * 1.57) * .14);
      arm.rotation.y = i * .8;
      group.add(arm);
    }
    strandUniforms.uLength.value = 2.3;
    armUniforms.uLength.value = 1.6;

    group.scale.setScalar(size);
    group.position.copy(home);
    scene.add(group);
    const jelly = { group, bell, shared, strandUniforms, armUniforms, home: home.clone(), phase, depth, size, hero, beat: phase };
    jellies.push(jelly);
    return jelly;
  };

  const hero = makeJelly({ color: '#ffc3cf', rim: '#ff8fb1', size: 1, home: new THREE.Vector3(.1, 1.45, .6), phase: 0, hero: true });
  makeJelly({ color: '#d7c6ff', rim: '#a98bff', size: .55, home: new THREE.Vector3(-2.7, 2.35, -1.2), phase: 1.3 });
  makeJelly({ color: '#bff3e6', rim: '#62d8c0', size: .48, home: new THREE.Vector3(2.75, 2.6, -1.6), phase: 2.4 });
  makeJelly({ color: '#ffe4b5', rim: '#ffb35e', size: .38, home: new THREE.Vector3(-1.6, .55, -2.6), phase: 3.7 });
  makeJelly({ color: '#c7e8ff', rim: '#74b8ff', size: .32, home: new THREE.Vector3(2.0, .45, -3.4), phase: 4.6 });
  makeJelly({ color: '#ffd0ea', rim: '#ff8fd0', size: .26, home: new THREE.Vector3(-3.9, 1.1, -4.6), phase: 5.5 });
  makeJelly({ color: '#e2ffd0', rim: '#9be071', size: .24, home: new THREE.Vector3(4.1, 1.6, -5.2), phase: 6.1 });

  // 主角水母的小脸：睁眼 / 闭眼 / 腮红 / 微笑。
  const face = new THREE.Group();
  const surface = (x, y, lift = 1.012) => new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))).multiplyScalar(lift);
  const placeOnSurface = (mesh, x, y, lift) => {
    const point = surface(x, y, lift);
    mesh.position.copy(point);
    mesh.lookAt(point.clone().multiplyScalar(2));
    face.add(mesh);
    return mesh;
  };
  const darkMaterial = keep(new THREE.MeshBasicMaterial({ color: '#3a2a35', fog: false }));
  const whiteMaterial = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
  const blushMaterial = keep(new THREE.MeshBasicMaterial({ color: '#ff7f9e', transparent: true, opacity: .55, depthWrite: false, fog: false }));
  const eyeGeometry = keep(new THREE.SphereGeometry(.075, 16, 12));
  const glintGeometry = keep(new THREE.CircleGeometry(.024, 12));
  const closedGeometry = keep(new THREE.TorusGeometry(.07, .016, 6, 18, Math.PI));
  const blushGeometry = keep(new THREE.CircleGeometry(.085, 20));
  const smileGeometry = keep(new THREE.TorusGeometry(.06, .014, 6, 18, Math.PI));
  const openEyes = new THREE.Group(), closedEyes = new THREE.Group(), eyeballs = [];
  face.add(openEyes, closedEyes);
  for (const side of [-1, 1]) {
    const eye = placeOnSurface(new THREE.Mesh(eyeGeometry, darkMaterial), side * .26, .36, 1.0);
    eye.scale.set(1, 1.15, .55);
    openEyes.add(eye);
    eyeballs.push(eye);
    const glint = placeOnSurface(new THREE.Mesh(glintGeometry, whiteMaterial), side * .26 - .025, .39, 1.05);
    openEyes.add(glint);
    const closed = placeOnSurface(new THREE.Mesh(closedGeometry, darkMaterial), side * .26, .35, 1.02);
    closed.rotateZ(Math.PI);
    closedEyes.add(closed);
    const blush = placeOnSurface(new THREE.Mesh(blushGeometry, blushMaterial), side * .43, .22, 1.02);
    blush.scale.set(1, .62, 1);
  }
  const smile = placeOnSurface(new THREE.Mesh(smileGeometry, darkMaterial), 0, .24, 1.02);
  smile.rotateZ(Math.PI);
  smile.scale.set(1, .8, 1);
  face.children.forEach(child => { child.renderOrder = 3; child.traverse?.(c => { c.renderOrder = 3; }); });
  hero.group.add(face);

  // 气泡与漂浮的小光点。
  const bubbleCount = 70;
  const bubbleGeometry = keep(new THREE.BufferGeometry());
  const bubbleSeeds = new Float32Array(bubbleCount * 3);
  const bubblePositions = new Float32Array(bubbleCount * 3);
  for (let i = 0; i < bubbleCount; i++) {
    bubbleSeeds.set([(Math.random() - .5) * 13, Math.random(), Math.random()], i * 3);
    bubblePositions.set([0, 0, -1 - Math.random() * 5], i * 3);
  }
  bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
  bubbleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(bubbleSeeds, 3));
  const pixelRatio = renderer.getPixelRatio();
  const bubbles = new THREE.Points(bubbleGeometry, keep(new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uScale: { value: 1 }, uRate: { value: .35 } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: `
      uniform float uTime;uniform float uScale;uniform float uRate;attribute vec3 aSeed;varying float vFade;
      void main(){
        float life=fract(aSeed.y+uTime*uRate*(.35+aSeed.z*.5)*.18);
        vec3 p=position;
        p.x=aSeed.x+sin(life*12.+aSeed.z*20.)*.18;
        p.y=-1.1+life*8.;
        vFade=smoothstep(0.,.08,life)*(1.-smoothstep(.8,1.,life));
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=uScale*(10.+aSeed.z*22.)/-mv.z;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float vFade;
      void main(){
        vec2 d=gl_PointCoord-.5;float r=length(d);
        if(r>.5)discard;
        float ring=smoothstep(.5,.42,r)*(.35+.65*smoothstep(.28,.48,r));
        float glint=smoothstep(.16,.0,length(d-vec2(-.15,-.15)));
        gl_FragColor=vec4(vec3(.92,1.,1.),(ring*.55+glint*.8)*vFade);
      }`,
  })));
  bubbles.frustumCulled = false;
  scene.add(bubbles);

  const moteCount = 140;
  const moteGeometry = keep(new THREE.BufferGeometry());
  const motePositions = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePositions.set([(Math.random() - .5) * 16, Math.random() * 6 - .8, -Math.random() * 9 + 1.5], i * 3);
    moteSeeds[i] = Math.random();
  }
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute('aSeed', new THREE.BufferAttribute(moteSeeds, 1));
  const motes = new THREE.Points(moteGeometry, keep(new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uScale: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `
      uniform float uTime;uniform float uAwake;uniform float uScale;attribute float aSeed;varying float vTw;
      void main(){
        vec3 p=position;
        p.x+=sin(uTime*.2+aSeed*30.)*.3;
        p.y+=sin(uTime*.27+aSeed*17.)*.25;
        vTw=(.45+.55*sin(uTime*(1.+aSeed*2.)+aSeed*40.))*(.45+.55*uAwake);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=uScale*(4.+aSeed*6.)/-mv.z*4.;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float vTw;
      void main(){
        float r=length(gl_PointCoord-.5);
        float a=smoothstep(.5,0.,r);
        gl_FragColor=vec4(vec3(1.,.97,.78)*a*vTw*.8,1.);
      }`,
  })));
  motes.frustumCulled = false;
  scene.add(motes);

  // 拖动视角：与森林场景一致，只做小角度查看，松手后回正。
  canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    orbit = THREE.MathUtils.clamp(orbit + (e.clientX - lastX) * .003, -.32, .32);
    tilt = THREE.MathUtils.clamp(tilt + (e.clientY - lastY) * .002, -.18, .18);
    lastX = e.clientX; lastY = e.clientY; updateCamera();
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const resize = () => {
    const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
    camera.aspect = w / h;
    // 窄屏时拉远一些，让主角水母和触须都留在画面里。
    camera.fov = w / h < 1.2 ? 52 : 42;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const scale = h * renderer.getPixelRatio() / 2;
    bubbles.material.uniforms.uScale.value = scale / 40;
    motes.material.uniforms.uScale.value = scale / 40;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  let status = 'idle', active = false, rafId = 0, previous = performance.now(), time = 0, awakeTime = 0, awake = 0, mode = '';
  let onActivity = () => {};

  const step = dt => {
    time += dt;
    const running = status === 'running';
    if (running) awakeTime += dt;
    awake = THREE.MathUtils.lerp(awake, running ? 1 : 0, 1 - Math.exp(-dt * 1.6));
    uniforms.uTime.value = reduced ? 0 : time;
    uniforms.uAwake.value = awake;
    bubbles.material.uniforms.uRate.value = .35 + awake * .9;

    // 学习中：每 16 秒一轮，先游动再吐泡泡；休息时慢慢漂浮。
    const cycle = awakeTime % 16;
    const nextMode = running ? (cycle < 11 ? 'swimming' : 'bubbling') : 'resting';
    if (nextMode !== mode) { mode = nextMode; onActivity(mode); }

    for (const jelly of jellies) {
      const beatRate = reduced ? 0 : THREE.MathUtils.lerp(.85, 2.3, awake) * (jelly.hero ? 1 : 1.12);
      jelly.beat += dt * beatRate;
      jelly.shared.uBeat.value = jelly.beat;
      jelly.shared.uPulse.value = THREE.MathUtils.lerp(.45, 1, awake);
      jelly.shared.uGlow.value = THREE.MathUtils.lerp(.1, 1, awake) * (mode === 'bubbling' && jelly.hero ? 1.4 : 1);
      jelly.shared.uOpacity.value = THREE.MathUtils.lerp(.5, .66, awake);
      const squeeze = .5 + .5 * Math.sin(jelly.beat + jelly.phase);
      // 收缩时向上推进，舒张时缓慢下沉；触须随之拖拽。
      jelly.strandUniforms.uSwing.value = THREE.MathUtils.lerp(.55, 1, awake);
      jelly.strandUniforms.uDrag.value = squeeze * jelly.shared.uPulse.value;
      jelly.armUniforms.uSwing.value = jelly.strandUniforms.uSwing.value;
      jelly.armUniforms.uDrag.value = jelly.strandUniforms.uDrag.value * .6;
      const t = reduced ? 0 : time;
      const roam = jelly.hero ? .45 : .8;
      const drift = THREE.MathUtils.lerp(.35, 1, awake);
      jelly.group.position.set(
        jelly.home.x + Math.sin(t * .23 + jelly.phase) * roam * drift,
        jelly.home.y + Math.sin(t * .41 + jelly.phase * 1.7) * .22 * drift + squeeze * .08 - (1 - awake) * .25 * (jelly.hero ? 1 : .6),
        jelly.home.z + Math.cos(t * .19 + jelly.phase) * .3 * drift,
      );
      jelly.group.rotation.z = Math.sin(t * .37 + jelly.phase) * .12 * drift;
      jelly.group.rotation.x = Math.cos(t * .29 + jelly.phase) * .08 * drift;
    }
    // 小脸跟着伞盖一起收缩，避免脱离表面。
    const heroSqueeze = (.5 + .5 * Math.sin(hero.beat + hero.phase)) * hero.shared.uPulse.value;
    face.scale.set(1 - .11 * heroSqueeze, 1 + .1 * heroSqueeze, 1 - .11 * heroSqueeze);
    // 主角面向镜头，便于看清表情。
    hero.group.rotation.y = Math.sin((reduced ? 0 : time) * .3) * .12;
    openEyes.visible = awake > .5;
    closedEyes.visible = !openEyes.visible;
    // 偶尔眨眼。
    if (openEyes.visible && !reduced) {
      const blink = (time % 4.2) < .12;
      for (const eye of eyeballs) eye.scale.y = blink ? .2 : 1.15;
    }

    if (!dragging && (Math.abs(orbit) > .0001 || Math.abs(tilt) > .0001)) {
      const smooth = 1 - Math.exp(-dt * 1.4);
      orbit = THREE.MathUtils.lerp(orbit, 0, smooth);
      tilt = THREE.MathUtils.lerp(tilt, 0, smooth);
      updateCamera();
    }
  };

  const frame = now => {
    rafId = active ? requestAnimationFrame(frame) : 0;
    const dt = Math.min((now - previous) / 1000, .06);
    previous = now;
    if (document.hidden || !mount.clientWidth || !mount.clientHeight) return;
    step(dt);
    renderer.render(scene, camera);
    mount.dataset.activity = mode;
    mount.dataset.motionTime = time.toFixed(2);
  };

  // 预热一帧：让首次显示时状态已就位。
  step(0);
  awake = status === 'running' ? 1 : 0;
  renderer.render(scene, camera);

  return {
    canvas,
    setStatus(next) {
      if (next === 'running' && status !== 'running') awakeTime = 0;
      status = next;
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active && !rafId) { previous = performance.now(); rafId = requestAnimationFrame(frame); }
      if (!active && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    },
    onActivity(callback) { onActivity = callback; if (mode) callback(mode); },
    snapAwake() { awake = status === 'running' ? 1 : 0; },
    dispose() {
      this.setActive(false);
      observer.disconnect();
      disposables.forEach(item => item.dispose?.());
      renderer.dispose();
      canvas.remove();
    },
  };
}
