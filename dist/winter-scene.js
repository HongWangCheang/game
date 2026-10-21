/** 冬天场景：雪景背景图上的飘雪，以及代替袋熊陪伴的小企鹅（由 Blender 模型 baby_penguin.blend 渲染的序列帧）。 */
export const PENGUIN_FRAMES = 28, PENGUIN_COLUMNS = 7;

export function createPenguin(THREE, texture) {
  texture.repeat.set(1 / PENGUIN_COLUMNS, 1 / Math.ceil(PENGUIN_FRAMES / PENGUIN_COLUMNS));
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  // 序列帧画面宽 1.25 个 Blender 单位，企鹅脚底位于画面底部向上约 13% 处。
  const size = 2.5, mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.geometry.translate(0, size * (.5 - .135), 0);
  mesh.renderOrder = 5;
  const rows = Math.ceil(PENGUIN_FRAMES / PENGUIN_COLUMNS);
  let frame = -1;
  return {
    mesh,
    material,
    setFrame(index) {
      index = ((index % PENGUIN_FRAMES) + PENGUIN_FRAMES) % PENGUIN_FRAMES;
      if (index === frame) return;
      frame = index;
      texture.offset.set((index % PENGUIN_COLUMNS) / PENGUIN_COLUMNS, 1 - (Math.floor(index / PENGUIN_COLUMNS) + 1) / rows);
    },
  };
}

export function createSnowfall(THREE, { width, height, centerY, count = 420 }) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const s = sprite.getContext('2d'), glow = s.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#ffffffff'); glow.addColorStop(.45, '#ffffffcc'); glow.addColorStop(1, '#ffffff00');
  s.fillStyle = glow; s.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(sprite);
  texture.colorSpace = THREE.SRGBColorSpace;

  const positions = new Float32Array(count * 3), speed = new Float32Array(count), sway = new Float32Array(count);
  const top = centerY + height / 2, bottom = centerY - height / 2;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * width;
    positions[i * 3 + 1] = bottom + Math.random() * height;
    positions[i * 3 + 2] = -1.2 + Math.random() * 3.2;
    speed[i] = .25 + Math.random() * .4;
    sway[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ map: texture, size: 6, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, sizeAttenuation: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; points.renderOrder = 10;

  return {
    points,
    material,
    update(dt, time) {
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        positions[k + 1] -= speed[i] * dt;
        positions[k] += Math.sin(time * .9 + sway[i]) * .12 * dt;
        if (positions[k + 1] < bottom) { positions[k + 1] = top; positions[k] = (Math.random() - .5) * width; }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
