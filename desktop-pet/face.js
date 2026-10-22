// 离开检测：学习时用摄像头看看你还在不在，连续几秒看不到人脸，小企鹅就做「找你」的动作。
// 画面只在本机内存里交给人脸检测模型（MediaPipe BlazeFace），不保存、不上传；没在学习时摄像头关闭。
import { FilesetResolver, FaceDetector } from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

const CHECK_EVERY = 500, AWAY_AFTER = 5000, BACK_AFTER = 1000;
let detector = null, stream = null, video = null, timer = 0;
let enabled = false, studying = false, present = true, lastSeen = 0, firstSeen = 0;

async function loadDetector() {
  const vision = await FilesetResolver.forVisionTasks(new URL('./node_modules/@mediapipe/tasks-vision/wasm', location.href).href);
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: new URL('./assets/models/blaze_face_short_range.tflite', location.href).href, delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: .5,
  });
}

function report(next) {
  if (next === present) return;
  present = next;
  window.dispatchEvent(new CustomEvent('face:presence', { detail: { present } }));
}

function check() {
  if (!video || video.readyState < 2) return;
  const now = performance.now();
  const found = detector.detectForVideo(video, now).detections.length > 0;
  if (found) {
    if (!firstSeen) firstSeen = now;
    lastSeen = now;
    if (!present && now - firstSeen >= BACK_AFTER) report(true);
  } else {
    firstSeen = 0;
    if (present && now - lastSeen >= AWAY_AFTER) report(false);
  }
}

async function start() {
  if (stream) return;
  try {
    if (!await window.pet.cameraAccess()) throw new Error('camera permission denied');
    detector ||= await loadDetector();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 5 }, audio: false });
    if (!enabled || !studying) { stop(); return; }
    video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: stream });
    await video.play();
    lastSeen = performance.now(); firstSeen = 0; present = true;
    timer = setInterval(check, CHECK_EVERY);
  } catch (error) {
    console.warn('Face detection unavailable', error);
    stop();
    window.dispatchEvent(new CustomEvent('face:error', { detail: { message: String(error.message || error) } }));
  }
}

function stop() {
  clearInterval(timer); timer = 0;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) { video.srcObject = null; video = null; }
  report(true);
}

function sync() { enabled && studying ? start() : stop(); }

window.pet.onStudy(status => { studying = status === 'running'; sync(); });
window.pet.onFaceSetting(value => { enabled = value; sync(); });
window.pet.getFaceSetting().then(value => { enabled = value; sync(); });
