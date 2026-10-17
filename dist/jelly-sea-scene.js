import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

/**
 * 果冻海：载入 Blender 果冻海方块（assets/jelly-sea.glb），并让小鱼、气泡和果冻表面动起来。
 * 只负责画面；学习状态通过 setStatus() 传入，不读写任何计时数据。
 *
 * 模型由 sea.blend 导出：修改器已应用，程序化材质的颜色烘焙为顶点色，
 * 自发光和果冻的透射效果在这里按原材质参数重建。
 */
const MODEL_URL = 'assets/jelly-sea.glb';

// 与 Blender 原材质一致的自发光颜色和强度（顶点色只包含底色）。
const EMISSION = {
  Clownfish_Mat: ['#ff4000', .7], Clownfish_Mat_Fin: ['#ff4000', .7], BlueTang_Mat: ['#0d45ff', .3],
  Coral_BlueBranch_Mat: ['#1a6bff', .3], Coral_Brain_Mat: ['#d926cc', .35], Coral_Orange_Mat: ['#ff4705', 1.1],
  Coral_Purple_Mat: ['#8c26ff', .5], Coral_Tube_Mat: ['#1a59ff', .25], Starfish_Mat: ['#ff4014', .7],
  Starfish_Purple_Mat: ['#8c33ff', .4], Starfish_Yellow_Mat: ['#ffad00', .6],
};
const ROUGHNESS = { FishEye_Mat: .05, Urchin_Mat: .3, Shell_A_Mat: .35, Shell_B_Mat: .35, WhiteSand_Mat: .9 };

export async function createJellySea(THREE, { mount, reduced = false } = {}) {
  if (!mount) throw new Error('createJellySea requires mount');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(MODEL_URL);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '果冻海：透明果冻方块里有白沙、珊瑚、海星和小鱼，学习时小鱼游动、冒泡泡，暂停时安静休息');
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environment = pmrem.fromScene(roomEnvironment, .04).texture;
  roomEnvironment.dispose?.();
  scene.environment = environment;
  scene.environmentIntensity = .55;

  // 柔和的暖粉背景，对应 Blender 场景里的背板。
  const backdropCanvas = document.createElement('canvas');
  backdropCanvas.width = backdropCanvas.height = 256;
  const context = backdropCanvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 105, 10, 128, 128, 190);
  gradient.addColorStop(0, '#fbf1ec');
  gradient.addColorStop(.6, '#ecd9d3');
  gradient.addColorStop(1, '#d8c0b9');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const backdrop = new THREE.CanvasTexture(backdropCanvas);
  backdrop.colorSpace = THREE.SRGBColorSpace;
  scene.background = backdrop;

  scene.add(new THREE.HemisphereLight('#f4fbff', '#c9a99f', 1.1));
  const key = new THREE.DirectionalLight('#fff4ea', 2.2);
  key.position.set(7.5, 7, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e6f2ff', .9);
  fill.position.set(-7, 5, 5.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#d9fff7', 1.2);
  rim.position.set(-3.5, 6, -6.5);
  scene.add(rim);

  const diorama = gltf.scene;
  const pivot = new THREE.Group();
  pivot.add(diorama);
  scene.add(pivot);

  const uniforms = { uTime: { value: 0 }, uWave: { value: 0 }, uTopY: { value: 2 } };
  let jelly = null;
  const fish = [], bubbles = [];
  const bubbleMaterial = new THREE.MeshStandardMaterial({ color: '#f2fdff', roughness: .06, metalness: .1, emissive: '#bff4ff', emissiveIntensity: .25 });
  const disposables = [backdrop, environment, pmrem, bubbleMaterial];

  diorama.traverse(object => {
    if (!object.isMesh) return;
    const name = object.material?.name || '';
    if (name === 'JellySea_Mat') {
      jelly = object;
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(.86, 1, .96), roughness: .03, ior: 1.34, transmission: 1, thickness: 2.4,
        attenuationColor: new THREE.Color(.55, .95, .9), attenuationDistance: 6,
        clearcoat: .5, clearcoatRoughness: .05, specularIntensity: 1, envMapIntensity: 1.2,
      });
      // 果冻表面轻轻起伏；越靠近顶部起伏越明显。
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uWave;uniform float uTopY;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float topness = smoothstep(uTopY - .45, uTopY, transformed.y);
            transformed.y += topness * uWave * (sin(transformed.x * 3.1 + uTime * 1.3) * .035 + cos(transformed.z * 2.7 - uTime * 1.05) * .03);`);
      };
      object.material = material;
      disposables.push(material);
      return;
    }
    if (name === 'Bubble_Mat') {
      // 透射材质看不到另一个透射物体，所以气泡用不透明的亮面小珠表现。
      object.material = bubbleMaterial;
      bubbles.push(object);
      return;
    }
    const material = object.material;
    material.vertexColors = Boolean(object.geometry.attributes.color);
    if (ROUGHNESS[name] !== undefined) material.roughness = ROUGHNESS[name];
    if (EMISSION[name]) {
      material.emissive = new THREE.Color(EMISSION[name][0]);
      material.emissiveIntensity = EMISSION[name][1] * .22;
    }
    material.needsUpdate = true;
    disposables.push(material, object.geometry);
  });
  if (!jelly) throw new Error('JellySea mesh missing from model');

  // 以果冻块为准算出内部可活动的范围（模型坐标）；小鱼和气泡都是模型的直接子节点。
  diorama.updateMatrixWorld(true);
  const jellyBox = new THREE.Box3().setFromObject(jelly);
  const sandBox = new THREE.Box3().setFromObject(diorama.getObjectByName('Sand') || jelly);
  const modelBox = new THREE.Box3().setFromObject(diorama);
  const inner = {
    minX: jellyBox.min.x + .3, maxX: jellyBox.max.x - .3, minZ: jellyBox.min.z + .3, maxZ: jellyBox.max.z - .3,
    floor: sandBox.max.y + .08, top: jellyBox.max.y - .25,
  };
  jelly.geometry.computeBoundingBox();
  uniforms.uTopY.value = jelly.geometry.boundingBox.max.y;
  // 方块底面中心放在原点，方便转动和压扁回弹。
  const center = modelBox.getCenter(new THREE.Vector3());
  diorama.position.set(-center.x, -modelBox.min.y, -center.z);

  // 落在地上的柔和阴影。
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
  shadowGradient.addColorStop(0, 'rgba(92,58,52,.42)');
  shadowGradient.addColorStop(1, 'rgba(92,58,52,0)');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowSize = modelBox.getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(shadowSize.x * 1.9, shadowSize.z * 1.9),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .002;
  scene.add(shadow);
  disposables.push(shadowTexture, shadow.geometry, shadow.material);

  // 小鱼：沿各自的椭圆路线游动，鱼头方向由眼睛的位置判断。
  for (const name of ['Fish_Clown_A', 'Fish_Clown_B', 'Fish_BlueTang']) {
    const object = diorama.getObjectByName(name);
    if (!object) continue;
    let headSign = 1;
    object.traverse(child => {
      if (child.isMesh && child.material?.name === 'FishEye_Mat') {
        child.geometry.computeBoundingBox();
        headSign = child.geometry.boundingBox.getCenter(new THREE.Vector3()).x < 0 ? -1 : 1;
      }
    });
    fish.push({ node: object, headSign });
  }
  fish.forEach((item, index) => {
    const start = item.node.position.clone();
    const cx = THREE.MathUtils.clamp(start.x, inner.minX + .55, inner.maxX - .55);
    const cz = THREE.MathUtils.clamp(start.z, inner.minZ + .55, inner.maxZ - .55);
    Object.assign(item, {
      cx, cz, baseY: THREE.MathUtils.clamp(start.y, inner.floor + .35, inner.top - .2),
      rx: .45 + (index % 3) * .12, rz: .35 + ((index + 1) % 3) * .1,
      angle: index * 2.1, direction: index % 2 ? -1 : 1, speed: .55 + index * .12, phase: index * 1.7,
    });
  });

  bubbles.forEach((bubble, index) => {
    const seed = Math.sin(index * 91.7) * .5 + .5;
    Object.assign(bubble.userData, {
      x: THREE.MathUtils.clamp(bubble.position.x, inner.minX, inner.maxX),
      z: THREE.MathUtils.clamp(bubble.position.z, inner.minZ, inner.maxZ),
      progress: seed, rate: .08 + seed * .07, wobble: index * 1.3,
    });
  });

  // 相机：沿用 Blender 相机的观察方向，按画框大小自动取景。
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const target = new THREE.Vector3(0, shadowSize.y * .5, 0);
  const viewDirection = new THREE.Vector3(7.3, 6.6 - 1.45, 6.9).normalize();
  const radius = shadowSize.length() * .5;
  let distance = 10;
  const placeCamera = () => {
    camera.position.copy(target).addScaledVector(viewDirection, distance);
    camera.lookAt(target);
  };
  const resize = () => {
    const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
    camera.aspect = w / h;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    distance = radius / Math.sin(Math.min(vertical, horizontal));
    camera.updateProjectionMatrix();
    placeCamera();
    renderer.setSize(w, h, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  // 拖动可以转动果冻块；松手后保持在新的角度。
  let yaw = 0, yawVelocity = 0, tilt = 0, dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; yawVelocity = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const delta = (e.clientX - lastX) * .008;
    yaw += delta; yawVelocity = delta * 30;
    tilt = THREE.MathUtils.clamp(tilt + (e.clientY - lastY) * .004, -.25, .3);
    lastX = e.clientX; lastY = e.clientY;
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let status = 'idle', active = false, rafId = 0, previous = performance.now(), time = 0, awakeTime = 0, awake = 0, mode = '';
  let jiggle = 0, jiggleVelocity = 0;
  let onActivity = () => {};

  const step = dt => {
    time += dt;
    const running = status === 'running';
    if (running) awakeTime += dt;
    awake = THREE.MathUtils.lerp(awake, running ? 1 : 0, 1 - Math.exp(-dt * 1.5));
    const t = reduced ? 0 : time;
    uniforms.uTime.value = t;
    uniforms.uWave.value = THREE.MathUtils.lerp(.35, 1, awake);

    // 学习中：每 16 秒一轮，先游动再吐泡泡；休息时小鱼停在珊瑚旁轻轻浮动。
    const cycle = awakeTime % 16;
    const nextMode = running ? (cycle < 11 ? 'swimming' : 'bubbling') : 'resting';
    if (nextMode !== mode) { mode = nextMode; onActivity(mode); }

    for (const item of fish) {
      item.angle += dt * item.speed * item.direction * THREE.MathUtils.lerp(.12, 1, awake) * (reduced ? 0 : 1);
      const x = item.cx + Math.cos(item.angle) * item.rx;
      const z = item.cz + Math.sin(item.angle) * item.rz;
      const y = item.baseY - (1 - awake) * .22 + Math.sin(t * 1.3 + item.phase) * THREE.MathUtils.lerp(.025, .07, awake);
      const vx = -Math.sin(item.angle) * item.rx * item.direction, vz = Math.cos(item.angle) * item.rz * item.direction;
      item.node.position.set(x, y, z);
      const heading = Math.atan2(-vz, vx) + (item.headSign < 0 ? Math.PI : 0);
      item.node.rotation.set(0, heading + Math.sin(t * THREE.MathUtils.lerp(3, 9, awake) + item.phase) * THREE.MathUtils.lerp(.04, .14, awake), 0);
    }

    const bubbleRate = THREE.MathUtils.lerp(.08, 1, awake) * (mode === 'bubbling' ? 2.2 : 1) * (reduced ? 0 : 1);
    for (const bubble of bubbles) {
      const data = bubble.userData;
      data.progress = (data.progress + dt * data.rate * bubbleRate) % 1;
      bubble.position.set(
        data.x + Math.sin(t * 1.6 + data.wobble) * .05,
        THREE.MathUtils.lerp(inner.floor, inner.top, data.progress),
        data.z + Math.cos(t * 1.3 + data.wobble) * .05,
      );
      const fade = Math.min(1, data.progress * 8, (1 - data.progress) * 10);
      bubble.scale.setScalar(Math.max(.001, fade));
    }

    // 果冻的弹性：状态改变时会“Duang”一下，之后慢慢平静。
    for (let left = dt; left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      jiggleVelocity += (-jiggle * 90 - jiggleVelocity * 7) * h;
      jiggle = THREE.MathUtils.clamp(jiggle + jiggleVelocity * h, -.12, .12);
    }
    const breathing = reduced ? 0 : Math.sin(t * THREE.MathUtils.lerp(1.2, 2.2, awake)) * THREE.MathUtils.lerp(.004, .009, awake);
    const squash = jiggle + breathing;
    pivot.scale.set(1 - squash * .5, 1 + squash, 1 - squash * .5);

    if (!dragging) {
      yaw += yawVelocity * dt;
      yawVelocity *= Math.exp(-dt * 3);
      tilt = THREE.MathUtils.lerp(tilt, 0, 1 - Math.exp(-dt * 1.2));
    }
    pivot.rotation.y = yaw + (reduced ? 0 : Math.sin(time * .25) * .08);
    pivot.rotation.x = tilt * .5;
  };

  const frame = () => {
    rafId = active ? requestAnimationFrame(frame) : 0;
    const now = performance.now();
    const dt = THREE.MathUtils.clamp((now - previous) / 1000, 0, .06);
    previous = now;
    if (document.hidden || !mount.clientWidth || !mount.clientHeight) return;
    step(dt);
    renderer.render(scene, camera);
    mount.dataset.activity = mode;
    mount.dataset.motionTime = time.toFixed(2);
  };

  step(0);
  renderer.render(scene, camera);

  return {
    canvas,
    setStatus(next) {
      if (next === status) return;
      if (next === 'running') awakeTime = 0;
      status = next;
      if (!reduced) jiggleVelocity += next === 'running' ? .9 : -.5;
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        if (!reduced) jiggleVelocity += .7;
        if (!rafId) { previous = performance.now(); rafId = requestAnimationFrame(frame); }
      } else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
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
