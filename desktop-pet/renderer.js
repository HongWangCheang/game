// 小企鹅的动画和行为：网站上学习时在屏幕底部走路陪你，其余时间坐着休息；菜单里也可以让它自由散步。
const FPS = 24, SIT_DOWN_END = 11, WALK_SPEED = 42;
const SHEETS = {
  walk: { src: 'assets/pet-walk.webp', frames: 28, columns: 7 },
  sit: { src: 'assets/pet-sit.webp', frames: 60, columns: 10 },
};
const canvas = document.getElementById('pet');
const bubble = document.getElementById('bubble');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const LINES = {
  hello: ['嗨，我来陪你啦！'],
  click: ['加油！', '你好专注呀～', '我陪着你呢', '再坚持一下！', '要喝口水吗？', '嘿嘿'],
  rest: ['休息一下～', '坐一会儿', '呼——'],
};

let mode = 'sit', clip = 'sit', frame = SIT_DOWN_END, queue = [], direction = -1;
let phaseEnds = 0, walking = false, dragging = null, bubbleTimer = 0;
const pick = list => list[Math.floor(Math.random() * list.length)];
const seconds = (min, max) => performance.now() + (min + Math.random() * (max - min)) * 1000;

function play(steps) { queue = steps; [clip, frame] = steps[0]; }
function standAndWalk() { play([['sit', SIT_DOWN_END, 0, false], ['walk', 0, 27, true]]); }
function sitAndRest() { play([['sit', 0, SIT_DOWN_END, false], ['sit', SIT_DOWN_END, 59, true]]); }

function say(text) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2600);
}

function setMode(next) {
  mode = next;
  if (next === 'sit') { walking = false; if (clip === 'walk') sitAndRest(); else play([['sit', SIT_DOWN_END, 59, true]]); say(pick(LINES.rest)); }
  else if (next === 'study') { walking = false; if (clip !== 'walk') standAndWalk(); say('陪你学习！'); }
  else if (next === 'studying') { walking = true; if (clip !== 'walk') standAndWalk(); }
  else { phaseEnds = 0; }
}

// 只有在网站上学习时才走路陪你；暂停、结束学习或没在学习时都坐着休息。
function onStudy(status) {
  if (status === 'running') { setMode('studying'); say(pick(['开始学习啦，我陪你！', '一起加油！'])); }
  else if (status === 'paused') setMode('sit');
  else { setMode('sit'); say('学完啦，辛苦了！'); }
}

// 散步模式：走 4–10 秒，坐下歇 6–15 秒，轮流进行。
function think(now) {
  if (mode !== 'wander' || dragging || now < phaseEnds) return;  // 学习中（studying）一直走，不会自己坐下
  if (walking) {
    walking = false; sitAndRest(); phaseEnds = seconds(6, 15);
    if (Math.random() < .3) say(pick(LINES.rest));
  } else {
    walking = true; standAndWalk(); phaseEnds = seconds(4, 10);
    if (Math.random() < .5) direction = -direction;
  }
}

function draw() {
  const sheet = SHEETS[clip];
  if (!sheet.image) return;
  const size = sheet.image.width / sheet.columns;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sheet.image, (frame % sheet.columns) * size, Math.floor(frame / sheet.columns) * size, size, size, 0, 0, canvas.width, canvas.height);
}

function step() {
  const [name, start, end, loop] = queue[0], delta = end >= start ? 1 : -1;
  clip = name;
  if (frame === end) {
    if (loop) frame = start;
    else if (queue.length > 1) { queue.shift(); [clip, frame] = queue[0]; }
  } else frame += delta;
}

let last = 0, acc = 0;
async function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - (last || now)) / 1000, .1); last = now;
  think(now);
  // 站起来的动作播完、真正在走的时候才移动窗口。
  if (walking && clip === 'walk' && !dragging) {
    const edge = await window.pet.walk(direction * WALK_SPEED * dt);
    if (edge) direction = -edge;
  }
  canvas.classList.toggle('facing-left', direction < 0 && clip === 'walk');
  acc += dt;
  if (acc < 1 / FPS) return;
  acc = 0;
  step();
  draw();
}

// 只有鼠标在小企鹅身上（不透明像素）时才接收点击，其余区域点击穿透到下面的软件。
let ignoring = true;
window.addEventListener('mousemove', event => {
  if (dragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width, y = (event.clientY - rect.top) * canvas.height / rect.height;
  const inside = x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
  const solid = inside && ctx.getImageData(canvas.classList.contains('facing-left') ? canvas.width - 1 - x : x, y, 1, 1).data[3] > 24;
  if (solid === ignoring) { ignoring = !solid; window.pet.ignoreMouse(ignoring); }
});

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragging = { x: event.screenX, y: event.screenY, moved: false };
  canvas.setPointerCapture(event.pointerId);
  window.pet.dragStart();
});
canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  if (Math.abs(event.screenX - dragging.x) + Math.abs(event.screenY - dragging.y) > 4) dragging.moved = true;
  if (dragging.moved) { canvas.style.cursor = 'grabbing'; window.pet.dragMove(); }
});
canvas.addEventListener('pointerup', () => {
  if (!dragging) return;
  window.pet.dragEnd();
  canvas.style.cursor = '';
  if (!dragging.moved) {
    canvas.classList.remove('hop'); void canvas.offsetWidth; canvas.classList.add('hop');
    say(pick(LINES.click));
  }
  dragging = null;
});
canvas.addEventListener('contextmenu', event => { event.preventDefault(); window.pet.menu(); });
window.pet.onMode(setMode);
window.pet.onStudy(onStudy);

Promise.all(Object.values(SHEETS).map(sheet => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => { sheet.image = image; resolve(); };
  image.onerror = reject;
  image.src = sheet.src;
}))).then(() => {
  play([['sit', SIT_DOWN_END, 59, true]]);
  draw();
  say(pick(LINES.hello));
  requestAnimationFrame(tick);
});
