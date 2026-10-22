/**
 * 桌宠小企鹅：开始学习后从陪伴框跳出来，浮在页面上一直陪着你。
 * 学习时走路，暂停时坐下休息，重置或结束本次学习后回到陪伴框。
 * 可拖动到任意位置（位置会记住）；支持的浏览器还能弹出「置顶小窗」，切到别的软件时也能看到它。
 * 画面来自 Blender 模型 baby_penguin.blend 的 Penguin_Walk / Penguin_Sit 透明背景序列帧。
 */
(() => {
  const POSITION_KEY = 'senli-pet-position';
  const FPS = 24, SIT_DOWN_END = 11;
  const SHEETS = {
    walk: { src: 'assets/pet-walk.webp', frames: 28, columns: 7 },
    sit: { src: 'assets/pet-sit.webp', frames: 60, columns: 10 },
  };
  const forest = document.getElementById('forest');
  const pet = document.getElementById('desk-pet');
  const canvas = pet.querySelector('canvas');
  const bubble = pet.querySelector('.desk-pet-bubble');
  const pipButton = document.getElementById('desk-pet-pip');
  const hideButton = document.getElementById('desk-pet-hide');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let status = forest.dataset.state || 'idle', dismissed = false, loading = null;
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

  function setVisible(visible) {
    if (visible && pet.hidden) { pet.classList.remove('is-out'); void pet.offsetWidth; pet.classList.add('is-out'); }
    pet.hidden = !visible;
    if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    if (!visible && raf && !pipWindow) { cancelAnimationFrame(raf); raf = 0; }
  }

  function sync(previous) {
    if (status === 'idle') {
      dismissed = false;
      pipWindow?.close();
      setVisible(false);
      return;
    }
    if (dismissed) return;
    loadSheets().then(() => {
      const wasRunning = previous === 'running';
      if (status === 'running') play(previous === 'paused' && !reduced
        ? [['sit', SIT_DOWN_END, 0, false], ['walk', 0, 27, true]]
        : [['walk', 0, 27, true]]);
      else play(wasRunning && !reduced
        ? [['sit', 0, SIT_DOWN_END, false], ['sit', SIT_DOWN_END, 59, true]]
        : [['sit', SIT_DOWN_END, 59, true]]);
      draw();
      setVisible(true);
      if (status === 'running' && previous === 'idle') say('我来陪你学习啦！');
    }).catch(error => console.warn('Desk pet unavailable', error));
  }

  function say(text) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2600);
  }

  // 拖动：位置以视口百分比保存，窗口大小变化后仍在屏幕内。
  const clampPosition = (x, y) => [Math.min(Math.max(x, 0), window.innerWidth - pet.offsetWidth), Math.min(Math.max(y, 0), window.innerHeight - pet.offsetHeight)];
  function place(x, y) { [x, y] = clampPosition(x, y); pet.style.left = `${x}px`; pet.style.top = `${y}px`; pet.style.right = pet.style.bottom = 'auto'; }
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    if (saved) requestAnimationFrame(() => place(saved.x * window.innerWidth, saved.y * window.innerHeight));
  } catch { /* 无痕模式等情况下使用默认位置 */ }

  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (pipWindow) return;
    const rect = pet.getBoundingClientRect();
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    drag.moved = true;
    pet.classList.add('dragging');
    place(event.clientX - drag.dx, event.clientY - drag.dy);
  });
  const endDrag = () => {
    if (!drag) return;
    pet.classList.remove('dragging');
    if (drag.moved) {
      const rect = pet.getBoundingClientRect();
      try { localStorage.setItem(POSITION_KEY, JSON.stringify({ x: rect.left / window.innerWidth, y: rect.top / window.innerHeight })); } catch { /* 忽略 */ }
    } else {
      pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop');
      say(status === 'running' ? ['加油！', '你好专注呀～', '我陪着你呢', '再坚持一下！'][Math.floor(Math.random() * 4)] : '休息一下也很好～');
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; pet.classList.remove('dragging'); });
  window.addEventListener('resize', () => { if (pet.style.left) place(pet.offsetLeft, pet.offsetTop); });

  hideButton.addEventListener('click', () => { dismissed = true; pipWindow?.close(); setVisible(false); });

  // 置顶小窗（Document Picture-in-Picture，Chrome / Edge 116+）：把桌宠放进一个总在最前面的小窗口。
  if ('documentPictureInPicture' in window) {
    pipButton.hidden = false;
    pipButton.addEventListener('click', async () => {
      if (pipWindow) { pipWindow.close(); return; }
      pipWindow = await window.documentPictureInPicture.requestWindow({ width: 220, height: 240 });
      const link = pipWindow.document.createElement('link');
      link.rel = 'stylesheet'; link.href = new URL('styles.css', location.href).href;
      pipWindow.document.head.append(link);
      pipWindow.document.title = '森里 · 小企鹅';
      pipWindow.document.body.className = 'desk-pet-pip-body';
      pipWindow.document.body.append(pet);
      pet.classList.add('in-pip');
      pipButton.setAttribute('aria-label', '收回置顶小窗'); pipButton.title = '收回置顶小窗';
      pipWindow.addEventListener('pagehide', () => {
        pet.classList.remove('in-pip');
        document.body.append(pet);
        pipWindow = null;
        pipButton.setAttribute('aria-label', '弹出置顶小窗'); pipButton.title = '弹出置顶小窗：切到别的软件时也能看到小企鹅';
        if (pet.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
      });
    });
  }

  document.addEventListener('study:state', event => {
    const previous = status;
    status = event.detail.status;
    if (status !== previous) sync(previous);
  });
  if (status !== 'idle') sync('idle');
})();
