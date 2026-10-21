/** 冬天场景：程序绘制的雪地、只剩枝干并挂着积雪的树，以及飘落的雪花。 */
const W = 1586, H = 992, HORIZON = 600;

function random(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function drawTree(ctx, rand, x, base, height, trunk, tone, snow) {
  const limbs = [];
  const grow = (x0, y0, length, angle, width, depth) => {
    const x1 = x0 + Math.cos(angle) * length, y1 = y0 + Math.sin(angle) * length;
    const bend = (rand() - .5) * length * .25;
    const mx = (x0 + x1) / 2 + Math.cos(angle + Math.PI / 2) * bend, my = (y0 + y1) / 2 + Math.sin(angle + Math.PI / 2) * bend;
    limbs.push({ x0, y0, mx, my, x1, y1, width, angle });
    if (depth <= 0 || width < .9) return;
    const count = depth > 3 ? 2 + (rand() < .4) : 2;
    for (let i = 0; i < count; i++) {
      const spread = (i / Math.max(count - 1, 1) - .5) * (.9 + rand() * .5);
      grow(x1, y1, length * (.62 + rand() * .2), angle + spread + (rand() - .5) * .25, width * .66, depth - 1);
    }
  };
  grow(x, base + 6, height * .38, -Math.PI / 2 + (rand() - .5) * .12, trunk, 7);
  ctx.lineCap = 'round';
  ctx.strokeStyle = tone;
  for (const l of limbs) {
    ctx.lineWidth = l.width;
    ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.quadraticCurveTo(l.mx, l.my, l.x1, l.y1); ctx.stroke();
  }
  // 积雪落在枝干朝上的一侧，越接近水平的树枝积得越厚。
  ctx.strokeStyle = snow;
  for (const l of limbs) {
    const flat = Math.abs(Math.cos(l.angle));
    if (flat < .25 || l.width < 1.2) continue;
    const lift = l.width * .45;
    ctx.lineWidth = Math.max(1.2, l.width * (.35 + .5 * flat));
    ctx.beginPath(); ctx.moveTo(l.x0, l.y0 - lift); ctx.quadraticCurveTo(l.mx, l.my - lift, l.x1, l.y1 - lift); ctx.stroke();
  }
  // 树根周围的雪堆和淡蓝阴影
  ctx.fillStyle = '#c9d6e6aa';
  ctx.beginPath(); ctx.ellipse(x + trunk * 1.4, base + 8, trunk * 3.2, trunk * .55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = snow;
  ctx.beginPath(); ctx.ellipse(x, base + 4, trunk * 1.6, trunk * .5, 0, Math.PI, 0); ctx.fill();
}

export function drawWinterBackdrop() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), rand = random(20261021);

  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#a9c0d8'); sky.addColorStop(.6, '#d9e4ee'); sky.addColorStop(1, '#eef2f6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * .56, 150, 10, W * .56, 150, 420);
  sun.addColorStop(0, '#fffaf0f0'); sun.addColorStop(.3, '#fff5e555'); sun.addColorStop(1, '#fff5e500');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

  // 远山：灰蓝山体和雪顶
  for (const [base, peak, tone, seed] of [[HORIZON - 40, 250, '#9fb2c8', 3], [HORIZON - 10, 330, '#b8c7d8', 9]]) {
    const r = random(seed);
    ctx.fillStyle = tone; ctx.beginPath(); ctx.moveTo(0, HORIZON);
    const tops = [];
    for (let x = 0; x <= W; x += 140) { const y = peak + r() * (base - peak); tops.push([x, y]); ctx.lineTo(x, y); }
    ctx.lineTo(W, HORIZON); ctx.fill();
    ctx.fillStyle = '#f4f7fb';
    for (let i = 1; i < tops.length - 1; i++) {
      const [x, y] = tops[i];
      if (y > tops[i - 1][1] || y > tops[i + 1][1]) continue;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 42, y + 40); ctx.lineTo(x - 14, y + 30); ctx.lineTo(x + 6, y + 44); ctx.lineTo(x + 40, y + 34); ctx.closePath(); ctx.fill();
    }
  }

  // 雪地：整片白色，带起伏的雪丘和淡蓝阴影
  const ground = ctx.createLinearGradient(0, HORIZON - 30, 0, H);
  ground.addColorStop(0, '#eef3f9'); ground.addColorStop(.45, '#f8fbff'); ground.addColorStop(1, '#ffffff');
  ctx.fillStyle = ground;
  ctx.beginPath(); ctx.moveTo(0, HORIZON - 10);
  for (let x = 0; x <= W; x += 60) ctx.lineTo(x, HORIZON - 14 + Math.sin(x * .006) * 12 + Math.sin(x * .017) * 5);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();

  // 远处的树林（淡色、较小）
  for (let i = 0; i < 26; i++) {
    const x = rand() * W, h = 90 + rand() * 80;
    drawTree(ctx, rand, x, HORIZON - 6 + rand() * 10, h, 2.2 + rand() * 1.5, '#8f9cad', '#f3f6fa');
  }
  // 中景树
  for (const x of [330, 520, 1060, 1230]) drawTree(ctx, rand, x + (rand() - .5) * 60, HORIZON + 40 + rand() * 30, 230 + rand() * 80, 6 + rand() * 3, '#6e6258', '#f7f9fc');

  for (let i = 0; i < 9; i++) {
    const x = rand() * W, y = HORIZON + 60 + rand() * (H - HORIZON - 80), rx = 120 + rand() * 220;
    const drift = ctx.createRadialGradient(x, y - 10, 0, x, y, rx);
    drift.addColorStop(0, '#ffffff'); drift.addColorStop(.7, '#f4f8fd'); drift.addColorStop(1, '#dfe8f300');
    ctx.fillStyle = drift; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#cdd9e766'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y + rx * .05, rx * .9, rx * .14, 0, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
  }

  // 前景两侧的大树，框住画面
  drawTree(ctx, rand, 95, H - 40, 820, 30, '#4f443c', '#ffffff');
  drawTree(ctx, rand, 1480, H - 30, 860, 34, '#4f443c', '#ffffff');

  // 雪面上的闪光
  for (let i = 0; i < 260; i++) {
    const y = HORIZON + rand() * (H - HORIZON);
    ctx.fillStyle = `rgba(255,255,255,${.5 + rand() * .5})`;
    ctx.fillRect(rand() * W, y, 1.5 + rand() * 1.5, 1.5 + rand() * 1.5);
  }
  return canvas;
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
