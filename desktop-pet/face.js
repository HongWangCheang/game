// 离开检测：学习时用摄像头看看你还在不在，连续 5 秒看不到人脸，小企鹅就进入愤怒模式；回来后继续走路。
// 只在网站上学习时打开摄像头；画面只在本机处理，不保存、不上传。
import * as vision from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';
import { createFaceWatcher } from './face-core.js';

let enabled = false, studying = false;
const watcher = createFaceWatcher({
  vision,
  wasmBase: new URL('./node_modules/@mediapipe/tasks-vision/wasm', location.href).href,
  modelUrl: new URL('./assets/models/blaze_face_short_range.tflite', location.href).href,
  onPresence: present => window.dispatchEvent(new CustomEvent('face:presence', { detail: { present } })),
  onError: error => window.dispatchEvent(new CustomEvent('face:error', { detail: { message: String(error.message || error) } })),
});

async function sync() {
  if (enabled && studying) {
    if (watcher.running) return;
    if (!await window.pet.cameraAccess()) {
      window.dispatchEvent(new CustomEvent('face:error', { detail: { message: 'camera permission denied' } }));
      return;
    }
    if (enabled && studying) await watcher.start();
    if (!(enabled && studying)) watcher.stop();
  } else watcher.stop();
}

window.pet.onStudy(status => { studying = status === 'running'; sync(); });
window.pet.onFaceSetting(value => { enabled = value; sync(); });
window.pet.getFaceSetting().then(value => { enabled = value; sync(); });
