import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';

/**
 * 冬天陪伴框：实时 3D 的 Blender 小企鹅（baby_penguin.blend 导出为 baby-penguin.glb）。
 * 学习时播放模型自带的 Penguin_Walk 走路动画，停止学习时停下；拖动可环绕查看，滚轮缩放。
 * Blender 里的毛发曲线无法导出，这里用多层外壳（shell fur）在身体、鳍和脚上重建绒毛。
 */
const FUR_SHELLS = 14, FUR_LENGTH = .022;
const FURRY = new Set(['Penguin_Body', 'Flipper.L', 'Flipper.R', 'Foot.L', 'Foot.R']);

function furMaterial(shell) {
  const t = shell / FUR_SHELLS;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uShell = { value: t };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uShell;\nvarying vec3 vFurPos;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vFurPos = position;
        transformed += normalize(objectNormal) * uShell * ${FUR_LENGTH.toFixed(4)};
        transformed.z -= uShell * uShell * .004;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uShell;
        varying vec3 vFurPos;
        float furHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uShell > 0.) {
          // 斜向网格加随机偏移，避免绒毛排成规则的同心纹。
          vec3 cell = mat3(.80, -.36, .48, .48, .86, -.17, -.36, .36, .86) * vFurPos * 300.;
          vec3 id = floor(cell);
          float strand = furHash(id);
          vec3 center = vec3(furHash(id + 1.7), furHash(id + 3.1), furHash(id + 5.3)) * .5 + .25;
          float radius = length(fract(cell) - center);
          if (strand < uShell * .9 || radius > (1. - uShell) * .62) discard;
        }
        diffuseColor.rgb *= mix(.6, 1.12, uShell);`);
  };
  material.customProgramCacheKey = () => `fur-${shell}`;
  return material;
}

export async function createPenguinScene({ mount, reduced }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '冬天的小企鹅：学习时走路，停止学习时停下，可拖动环绕查看');
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9d6c8');
  scene.fog = new THREE.Fog('#e6d8d0', 14, 90);
  scene.add(new THREE.HemisphereLight('#ffe9d6', '#b9c4d6', 1.6));
  const sun = new THREE.DirectionalLight('#ffd2a8', 2.4);
  sun.position.set(-3, 4, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: .5, far: 15 });
  sun.shadow.bias = -.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#fff4e8', 1.2);
  rim.position.set(-1.3, 1.4, -1.9);
  scene.add(rim);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/baby-penguin.glb');
  const model = gltf.scene;
  const snow = new THREE.MeshStandardMaterial({ color: '#f3f5fa', roughness: .9 });
  const ice = new THREE.MeshStandardMaterial({ color: '#cfe6f0', roughness: .35 });
  const furShells = [];
  model.traverse(node => {
    if (!node.isMesh) return;
    const name = node.name.replace(/_\d+$/, ''), material = node.material?.name || '';
    if (material === 'M_Snow') node.material = snow;
    else if (material === 'M_Ice' || /^Iceberg/.test(name)) node.material = ice;
    else if (material === 'M_Mountain') node.material = new THREE.MeshStandardMaterial({ color: '#d9dde8', roughness: 1 });
    else if (material === 'M_Eye') node.material = new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: .05, clearcoat: 1 });
    else if (material === 'M_Beak') node.material = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .5 });
    node.receiveShadow = true;
    if (node.isSkinnedMesh || FURRY.has(node.parent?.name) || material === 'M_Down') {
      node.castShadow = true;
      node.material = furMaterial(0);
      for (let shell = 1; shell <= FUR_SHELLS; shell++) furShells.push([node, shell]);
    }
  });
  for (const [node, shell] of furShells) {
    const copy = node.isSkinnedMesh ? new THREE.SkinnedMesh(node.geometry, furMaterial(shell)) : new THREE.Mesh(node.geometry, furMaterial(shell));
    if (node.isSkinnedMesh) copy.bind(node.skeleton, node.bindMatrix);
    copy.position.copy(node.position); copy.quaternion.copy(node.quaternion); copy.scale.copy(node.scale);
    copy.frustumCulled = false;
    node.parent.add(copy);
  }
  scene.add(model);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshStandardMaterial({ color: '#2b4a63', roughness: .25, metalness: .1 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -.35, -70);
  scene.add(ocean);

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  const target = new THREE.Vector3(0, .45, 0);
  let yaw = 0, pitch = .05, distance = 2.4, dragging = false, lastX = 0, lastY = 0, idle = 0;
  const updateCamera = () => {
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance);
    camera.lookAt(target);
  };
  const resize = () => {
    const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
  };
  new ResizeObserver(resize).observe(mount); resize(); updateCamera();

  canvas.addEventListener('pointerdown', event => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * .008;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * .005, -.05, .9);
    lastX = event.clientX; lastY = event.clientY; idle = 0; updateCamera();
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    distance = THREE.MathUtils.clamp(distance * (1 + Math.sign(event.deltaY) * .08), 1.3, 5);
    updateCamera();
  }, { passive: false });

  const mixer = new THREE.AnimationMixer(model);
  const walk = mixer.clipAction(gltf.animations.find(clip => clip.name === 'Penguin_Walk') || gltf.animations[0]);
  walk.setLoop(THREE.LoopRepeat, Infinity);
  let walking = false, active = false, previous = performance.now();

  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, .06); previous = now;
    if (!active || document.hidden || !mount.clientWidth) return;
    mixer.update(dt);
    // 松手几秒后镜头慢慢回到正面。
    idle += dt;
    if (!dragging && idle > 4 && (Math.abs(yaw) > .001 || Math.abs(pitch - .05) > .001)) {
      const smooth = 1 - Math.exp(-dt * 1.2);
      yaw = THREE.MathUtils.lerp(yaw, Math.round(yaw / (Math.PI * 2)) * Math.PI * 2, smooth);
      pitch = THREE.MathUtils.lerp(pitch, .05, smooth);
      updateCamera();
    }
    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);

  return {
    canvas,
    setActive(value) { active = value; },
    setWalking(value) {
      if (value === walking) return;
      walking = value;
      if (value) { walk.reset().fadeIn(reduced ? 0 : .25).play(); walk.timeScale = reduced ? .5 : 1; }
      else walk.fadeOut(reduced ? 0 : .3);
    },
  };
}
