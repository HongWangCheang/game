/** 冬天：网页背景飘雪，陪伴框播放 Blender 小企鹅动画——学习时循环播放，停止学习时停在第一帧。 */
(() => {
  const forest = document.getElementById('forest');
  const video = document.getElementById('world-winter');
  const canvas = document.getElementById('page-snow');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWinter = () => forest.dataset.season === 'winter';
  let running = forest.dataset.state === 'running';

  function syncPenguin() {
    if (isWinter() && running) {
      if (video.preload === 'none') { video.preload = 'auto'; video.load(); }
      video.play().catch(() => { /* 浏览器拒绝自动播放时停在第一帧 */ });
    } else {
      video.pause();
      if (video.readyState > 0) video.currentTime = 0;
    }
  }

  const ctx = canvas.getContext('2d');
  const flakes = [];
  let width = 0, height = 0, last = 0, frame = 0;
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const target = Math.round(Math.min(220, width * height / 7000));
    while (flakes.length < target) flakes.push(makeFlake(true));
    flakes.length = target;
  }
  function makeFlake(anywhere) {
    const r = .8 + Math.random() * 2.6;
    return { x: Math.random() * width, y: anywhere ? Math.random() * height : -6, r, speed: 18 + r * 14 + Math.random() * 12, phase: Math.random() * 6.28, alpha: .45 + Math.random() * .5 };
  }
  function draw(now) {
    frame = isWinter() ? requestAnimationFrame(draw) : 0;
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
    ctx.clearRect(0, 0, width, height);
    for (const f of flakes) {
      if (!reduced) {
        f.y += f.speed * dt;
        f.x += Math.sin(now / 1100 + f.phase) * 12 * dt;
        if (f.y > height + 6) Object.assign(f, makeFlake(false));
      }
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    if (reduced) frame = 0;
  }
  function syncSnow() {
    if (isWinter() && !frame) { last = 0; frame = requestAnimationFrame(draw); }
  }

  window.addEventListener('resize', resize);
  resize();
  document.addEventListener('study:state', event => { running = event.detail.status === 'running'; syncPenguin(); });
  document.addEventListener('season:change', () => { syncPenguin(); syncSnow(); });
  syncPenguin(); syncSnow();
})();
