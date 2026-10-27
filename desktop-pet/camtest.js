// 摄像头测试窗口：实时显示摄像头画面和人脸框，方便确认「离开检测」能不能认出你。
import * as vision from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';
import { createFaceWatcher } from './face-core.js';

const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
const status = document.getElementById('status'), detail = document.getElementById('detail');
const show = (text, ok, more = '') => { status.textContent = text; status.className = ok === undefined ? '' : ok ? 'ok' : 'no'; detail.textContent = more; };

const watcher = createFaceWatcher({
  vision,
  wasmBase: new URL('./node_modules/@mediapipe/tasks-vision/wasm', location.href).href,
  modelUrl: new URL('./assets/models/blaze_face_short_range.tflite', location.href).href,
  onSample: ({ frame, detections, width, height }) => {
    canvas.width = width; canvas.height = height;
    ctx.drawImage(frame, 0, 0, width, height);
    // 整体偏暗时提示开灯：画面太暗是认不出人脸最常见的原因。
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let sum = 0; for (let i = 0; i < pixels.length; i += 40) sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
    const brightness = sum / (pixels.length / 40) / 3;
    ctx.lineWidth = 4; ctx.strokeStyle = '#4caf50';
    for (const d of detections) { const b = d.boundingBox; ctx.strokeRect(b.originX, b.originY, b.width, b.height); }
    const score = detections[0]?.categories?.[0]?.score;
    if (detections.length) show(`✓ 认出你了（把握 ${Math.round(score * 100)}%）`, true, `画面 ${width}×${height}，亮度 ${Math.round(brightness)}`);
    else show('✗ 没有认出人脸', false, brightness < 40
      ? `画面太暗（亮度 ${Math.round(brightness)}），开一下灯或面向光源。`
      : `画面 ${width}×${height}，亮度 ${Math.round(brightness)}。请正对摄像头，离屏幕 30–100 厘米。`);
  },
  onError: error => show('摄像头打不开', false, `${error.name || ''} ${error.message || error}。请到「系统设置 → 隐私与安全性 → 摄像头」里允许 Senli Penguin。`),
});

(async () => {
  if (!await window.pet.cameraAccess()) { show('没有摄像头权限', false, '请到「系统设置 → 隐私与安全性 → 摄像头」里打开 Senli Penguin，然后重新打开这个窗口。'); return; }
  await watcher.start();
})();
window.addEventListener('beforeunload', () => watcher.stop());
