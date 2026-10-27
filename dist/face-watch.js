/**
 * 网页版离开检测：打开陪伴框右上角的 📷 后，学习时用摄像头看看你还在不在。
 * 连续 5 秒看不到人脸，生气的小企鹅（Blender 动作 Penguin_Angry）就会跳出来，标签页标题也会提醒「快回来学习」；
 * 回来 1 秒后它消气离开。画面只在本机浏览器里处理，不保存、不上传；没在学习时摄像头关闭。
 * 识别模型（约 12 MB）只在第一次打开 📷 时下载。
 */
import { createFaceWatcher } from './face-core.js';

const ENABLED_KEY = 'senli-face-watch';
const FPS = 24, ANGRY = { src: 'assets/pet-angry.webp', frames: 48, columns: 8, loopStart: 11 };
const forest = document.getElementById('forest');
const button = document.getElementById('face-watch');
const overlay = document.getElementById('angry-pet');
const canvas = overlay.querySelector('canvas');
const bubble = overlay.querySelector('.angry-pet-bubble');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const announce = text => { const node = document.getElementById('announcement'); if (node) node.textContent = text; };
const toast = text => {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = text; node.classList.add('visible');
  setTimeout(() => node.classList.remove('visible'), 3600);
};

let enabled = false, running = forest.dataset.state === 'running', away = false, watcher = null;
try { enabled = localStorage.getItem(ENABLED_KEY) === 'on'; } catch { /* 无痕模式等情况下默认关闭 */ }

// 生气小企鹅的序列帧动画：先播生气起来的过程，再循环生气的样子；回来时倒着播，消气后隐藏。
const sheet = new Image();
let frame = 0, target = 'idle', raf = 0, last = 0, acc = 0;
function draw() {
  if (!sheet.complete || !sheet.naturalWidth) return;
  const size = sheet.naturalWidth / ANGRY.columns;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sheet, (frame % ANGRY.columns) * size, Math.floor(frame / ANGRY.columns) * size, size, size, 0, 0, canvas.width, canvas.height);
}
function tick(now) {
  raf = requestAnimationFrame(tick);
  acc += Math.min((now - (last || now)) / 1000, .1); last = now;
  if (acc < 1 / FPS) return;
  acc = 0;
  if (target === 'angry') frame = frame >= ANGRY.frames - 1 ? ANGRY.loopStart : frame + 1;
  else if (frame > 0) frame = Math.min(frame, ANGRY.loopStart) - 1;
  else { overlay.hidden = true; cancelAnimationFrame(raf); raf = 0; return; }
  draw();
}
function animate(next) {
  target = next;
  if (next === 'angry') { overlay.hidden = false; if (reduced) frame = ANGRY.loopStart; }
  if (reduced) { if (next !== 'angry') { frame = 0; overlay.hidden = true; } draw(); return; }
  if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
}

// 离开时改标签页标题，切到别的标签页也能看到提醒。
let savedTitle = '', titleTimer = 0;
function remindInTitle(on) {
  clearInterval(titleTimer);
  if (on) {
    savedTitle = document.title;
    let flip = false;
    titleTimer = setInterval(() => { flip = !flip; document.title = flip ? '😠 快回来学习！' : savedTitle; }, 1000);
  } else if (savedTitle) { document.title = savedTitle; savedTitle = ''; }
}

const pick = list => list[Math.floor(Math.random() * list.length)];
function onPresence(present) {
  away = !present;
  document.dispatchEvent(new CustomEvent('face:presence', { detail: { present } }));
  if (away) {
    bubble.textContent = pick(['哼！说好一起学习的呢？', '你跑哪儿去啦！', '快回来学习！']);
    animate('angry'); remindInTitle(true); announce('检测不到你，小企鹅生气了：快回来学习！');
  } else {
    bubble.textContent = pick(['欢迎回来！这次原谅你～', '你回来啦，继续加油！']);
    animate('idle'); remindInTitle(false); announce('欢迎回来，继续学习吧。');
  }
}

async function ensureWatcher() {
  if (watcher) return watcher;
  const vision = await import('./vendor/mediapipe/vision_bundle.mjs');
  watcher = createFaceWatcher({
    vision,
    wasmBase: new URL('vendor/mediapipe/wasm', location.href).href,
    modelUrl: new URL('assets/models/blaze_face_short_range.tflite', location.href).href,
    onPresence,
    onError: error => {
      setEnabled(false);
      toast(error?.name === 'NotAllowedError' ? '没有摄像头权限：点地址栏左边的图标允许使用摄像头后再打开 📷' : '摄像头打不开，离开检测已关闭');
    },
  });
  return watcher;
}

async function sync() {
  if (enabled && running) {
    if (!sheet.src) sheet.src = ANGRY.src;
    try { await (await ensureWatcher()).start(); }
    catch (error) { console.warn('Face watch unavailable', error); setEnabled(false); toast('离开检测加载失败，请检查网络后再试'); }
    if (!(enabled && running)) watcher?.stop();
  } else {
    watcher?.stop();
    if (away) onPresence(true);
  }
}

function setEnabled(value) {
  enabled = value;
  button.setAttribute('aria-pressed', String(value));
  button.title = value ? '离开检测已开启：学习时看不到你，小企鹅会生气（点击关闭）' : '离开检测：学习时用摄像头看看你还在不在（点击开启）';
  try { localStorage.setItem(ENABLED_KEY, value ? 'on' : 'off'); } catch { /* 只在本次页面生效 */ }
}

if (navigator.mediaDevices?.getUserMedia) {
  button.hidden = false;
  setEnabled(enabled);
  button.addEventListener('click', () => {
    setEnabled(!enabled);
    toast(enabled ? (running ? '离开检测已开启' : '离开检测已开启，开始学习后生效') : '离开检测已关闭，摄像头不再使用');
    sync();
  });
}
document.addEventListener('study:state', event => { running = event.detail.status === 'running'; sync(); });
if (running) sync();
