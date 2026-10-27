/**
 * 桌宠小企鹅：网页里不显示；点「开始学习」后弹出一个总在最前面的小窗口，
 * 切到别的网页或软件（例如 Pages）时它也一直在旁边陪着你。
 * 学习时走路，暂停时坐下休息，重置或结束本次学习后自动收起。小窗口可以拖到屏幕任意位置。
 * 如果电脑上开着 Mac 桌宠 App（desktop-pet/），学习状态会同步给 App，网页不再弹小窗口。
 * 画面来自 Blender 模型 baby_penguin.blend 的 Penguin_Walk / Penguin_Sit 透明背景序列帧。
 */
(() => {
  const FPS = 24, SIT_DOWN_END = 11;
  const SHEETS = {
    walk: { src: 'assets/pet-walk.webp', frames: 28, columns: 7 },
    sit: { src: 'assets/pet-sit.webp', frames: 60, columns: 10 },
  };
  const forest = document.getElementById('forest');
  const pet = document.getElementById('desk-pet');
  const canvas = pet.querySelector('canvas');
  const bubble = pet.querySelector('.desk-pet-bubble');
  const hideButton = document.getElementById('desk-pet-hide');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let status = forest.dataset.state || 'idle', loading = null;
  let clip = 'sit', frame = 0, elapsed = 0, last = 0, raf = 0, pipWindow = null, bubbleTimer = 0;
  // 播放队列：[动作, 起始帧, 结束帧, 是否循环]
  let queue = [['sit', SIT_DOWN_END, 59, true]];

  const loadSheets = () => loading ||= Promise.all(Object.values(SHEETS).map(sheet => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { sheet.image = image; sheet.size = image.width / sheet.columns; resolve(); };
    image.onerror = reject;
    image.src = sheet.src;
  })));

  function play(steps) { queue = steps; [clip, frame] = steps[0]; elapsed = 0; }

  function draw() {
    const sheet = SHEETS[clip];
    if (!sheet.image) return;
    const { size, columns } = sheet;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sheet.image, (frame % columns) * size, Math.floor(frame / columns) * size, size, size, 0, 0, canvas.width, canvas.height);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    elapsed += Math.min((now - (last || now)) / 1000, .1); last = now;
    if (elapsed < 1 / FPS) return;
    elapsed = 0;
    if (!reduced) {
      const [name, start, end, loop] = queue[0], step = end >= start ? 1 : -1;
      clip = name;
      if (frame === end) {
        if (loop) frame = start;
        else if (queue.length > 1) { queue.shift(); [clip, frame] = queue[0]; }
      } else frame += step;
    }
    draw();
  }

  const supported = 'documentPictureInPicture' in window;

  function animate(on) {
    if (on && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function applyPose(previous) {
    if (status === 'running') play(previous === 'paused' && !reduced
      ? [['sit', SIT_DOWN_END, 0, false], ['walk', 0, 27, true]]
      : [['walk', 0, 27, true]]);
    else play(previous === 'running' && !reduced
      ? [['sit', 0, SIT_DOWN_END, false], ['sit', SIT_DOWN_END, 59, true]]
      : [['sit', SIT_DOWN_END, 59, true]]);
    draw();
  }

  function say(text) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2600);
  }

  // 置顶小窗：Document Picture-in-Picture 窗口总在所有软件最前面，切到别的网页或 Pages 等应用时小企鹅也一直在。
  // 浏览器只允许在点击时打开，所以在点「开始学习」或召唤按钮的那一下打开。
  async function openPip() {
    if (!supported || pipWindow) return;
    try {
      const opening = window.documentPictureInPicture.requestWindow({ width: 200, height: 220 });
      await loadSheets();
      pipWindow = await opening;
    } catch (error) { console.warn('Desk pet window unavailable', error); return; }
    const doc = pipWindow.document;
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('styles.css', location.href).href;
    doc.head.append(link);
    doc.title = '萌宠监管 · 小企鹅';
    doc.body.className = 'desk-pet-pip-body';
    doc.body.append(pet);
    pet.hidden = false;
    summon?.setAttribute('aria-pressed', 'true');
    applyPose('idle');
    animate(true);
    say(status === 'running' ? '我来陪你学习啦！' : '我在这儿陪你～');
    pipWindow.addEventListener('pagehide', () => {
      pet.hidden = true;
      document.body.append(pet);
      pipWindow = null;
      animate(false);
      summon?.setAttribute('aria-pressed', 'false');
    });
  }

  canvas.addEventListener('click', () => {
    pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop');
    say(status === 'running' ? ['加油！', '你好专注呀～', '我陪着你呢', '再坚持一下！'][Math.floor(Math.random() * 4)] : '休息一下也很好～');
  });
  hideButton.addEventListener('click', () => pipWindow?.close());

  // 陪伴框里的召唤按钮：随时打开 / 收起桌宠小窗。
  const summon = document.getElementById('desk-pet-summon');
  if (supported && summon) {
    summon.hidden = false;
    summon.addEventListener('click', () => pipWindow ? pipWindow.close() : openPip());
  }
  // 和 Mac 桌宠 App（desktop-pet/）同步：App 在本机 127.0.0.1:47321 接收学习状态。
  // 检测到 App 在运行时，由 App 里的小企鹅陪伴，网页就不再弹出小窗口，避免出现两只。
  const BRIDGE = 'http://127.0.0.1:47321';
  let desktopPet = false, heartbeat = 0;
  const checkDesktopPet = () => fetch(`${BRIDGE}/hello`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => { desktopPet = data?.app === 'senli-desktop-pet'; })
    .catch(() => { desktopPet = false; });
  const tellDesktopPet = () => fetch(`${BRIDGE}/study`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }), keepalive: true,
  }).then(response => { desktopPet = response.ok; }).catch(() => { desktopPet = false; });
  checkDesktopPet();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDesktopPet(); });
  window.addEventListener('pagehide', () => { if (desktopPet && status !== 'idle') { status = 'idle'; tellDesktopPet(); } });

  // 开始学习的那一下自动请小企鹅出来（捕获阶段，确保仍在这次点击里）。
  document.getElementById('toggle').addEventListener('click', () => {
    if (status !== 'running' && status !== 'paused' && !desktopPet) openPip();
  }, true);

  function sync(previous) {
    // 学习中每 30 秒报一次平安，App 迟一点打开也能跟上；网页关掉后 App 会自动结束陪伴。
    if (desktopPet || status !== 'idle') tellDesktopPet();
    clearInterval(heartbeat);
    if (status !== 'idle') heartbeat = setInterval(tellDesktopPet, 30000);
    if (status === 'idle') { pipWindow?.close(); return; }
    if (pipWindow) applyPose(previous);
  }

  document.addEventListener('study:state', event => {
    const previous = status;
    status = event.detail.status;
    if (status !== previous) sync(previous);
  });
  if (status !== 'idle') sync('idle');
})();
