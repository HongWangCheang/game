import * as THREE from './vendor/three.module.js';

/** 森林 / 果冻海场景切换：只改变画面，不触碰计时、记录或本地学习数据。 */
const SCENE_KEY = 'senli-scene';
const forest = document.getElementById('forest');
const button = document.getElementById('scene-switch');
const mount = document.getElementById('world-sea');
const seaSpeech = document.getElementById('sea-speech');
const seaStatus = document.getElementById('sea-status');
const seaLabel = document.getElementById('sea-label');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SCENES = { forest: '森林', sea: '果冻海' };

let sea = null, seaLoading = null, seaMode = 'resting';

const readScene = () => { try { return localStorage.getItem(SCENE_KEY) === 'sea' ? 'sea' : 'forest'; } catch { return 'forest'; } };
const saveScene = scene => { try { localStorage.setItem(SCENE_KEY, scene); } catch { /* 无痕模式等情况下只在本次页面生效 */ } };
const studyStatus = () => forest.dataset.state || 'idle';

function renderSeaText() {
  const status = studyStatus(), running = status === 'running', paused = status === 'paused';
  seaSpeech.textContent = running ? '咕噜噜，我们陪你一起专注！' : paused ? '你休息，我们也漂一会儿…' : '果冻海静悄悄的…';
  seaStatus.textContent = running ? '水母们正在陪你学习' : paused ? '水母们正在休息' : '开始学习，点亮果冻海';
  if (!sea) { seaLabel.textContent = running ? '游动中' : '漂浮中'; return; }
  seaLabel.textContent = seaMode === 'swimming' ? '游动中' : seaMode === 'bubbling' ? '吐泡泡' : '漂浮中';
}

function loadSea() {
  seaLoading ||= import('./jelly-sea-scene.js').then(({ createJellySea }) => {
    sea = createJellySea(THREE, { mount, reduced });
    sea.setStatus(studyStatus());
    sea.snapAwake();
    sea.onActivity(mode => { seaMode = mode; renderSeaText(); });
    sea.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); sea.setActive(false); seaLabel.textContent = '画面暂不可用'; });
    forest.classList.add('sea-ready');
    return sea;
  }).catch(error => {
    // WebGL 不可用时保留果冻海的渐变底色和文字，计时照常进行。
    seaLabel.textContent = '果冻海';
    console.warn('Jelly sea unavailable', error);
    return null;
  });
  return seaLoading;
}

function applyScene(scene, { persist = true } = {}) {
  const isSea = scene === 'sea';
  forest.dataset.scene = scene;
  const next = isSea ? SCENES.forest : SCENES.sea;
  button.setAttribute('aria-pressed', String(isSea));
  button.setAttribute('aria-label', `切换场景：前往${next}`);
  button.title = `切换场景：${next}`;
  mount.setAttribute('aria-hidden', String(!isSea));
  if (persist) saveScene(scene);
  if (isSea) loadSea().then(controller => { if (controller && forest.dataset.scene === 'sea') controller.setActive(true); });
  else sea?.setActive(false);
  renderSeaText();
  document.dispatchEvent(new CustomEvent('scene:change', { detail: { scene } }));
}

button.addEventListener('click', () => applyScene(forest.dataset.scene === 'sea' ? 'forest' : 'sea'));
document.addEventListener('study:state', event => {
  sea?.setStatus(event.detail.status);
  renderSeaText();
});
applyScene(readScene(), { persist: false });
