/** 冬天：网页背景飘雪，陪伴框显示实时 3D 的 Blender 小企鹅——开始学习后同步走路，停止学习时停下。 */
(() => {
  const forest = document.getElementById('forest');
  const mount = document.getElementById('world-winter');
  const canvas = document.getElementById('page-snow');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWinter = () => forest.dataset.season === 'winter';
  let running = forest.dataset.state === 'running';

  // 实时 3D 小企鹅在第一次切到冬天时才加载。
  let penguin = null, loading = null;
  function syncPenguin() {
    if (isWinter() && !loading) {
      loading = import('./penguin-scene.js')
        .then(({ createPenguinScene }) => createPenguinScene({ mount: mount, reduced }))
        .then(scene => { penguin = scene; forest.classList.add('penguin-ready'); syncPenguin(); })
        .catch(error => console.warn('Penguin scene unavailable', error));
    }
    penguin?.setActive(isWinter());
    penguin?.setWalking(isWinter() && running);
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
