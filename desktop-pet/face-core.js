// 萌宠监管 · 离开检测核心（桌宠 App 和网站共用，两边文件保持一致）。
// 打开摄像头，每 0.5 秒用 MediaPipe BlazeFace 检测一次人脸：连续 AWAY_AFTER 毫秒看不到 → 离开；重新看到 BACK_AFTER 毫秒 → 回来。
// 画面只在本机内存里处理，不保存、不上传。
//
// 取帧优先用 ImageCapture.grabFrame()：窗口在后台、被遮挡或页面不可见时，<video> 可能停在第一帧（摄像头刚打开时常是黑的），
// 导致一直「检测不到人脸」；grabFrame 每次都直接向摄像头要最新的一帧。不支持时退回到挂在页面上的隐藏 <video>。

const CHECK_EVERY = 500, AWAY_AFTER = 5000, BACK_AFTER = 1000, WARM_UP = 1500;

export function createFaceWatcher({ vision, wasmBase, modelUrl, onPresence, onSample, onError }) {
  let detector = null, stream = null, track = null, capture = null, video = null, timer = 0, busy = false;
  let present = true, startedAt = 0, lastSeen = 0, firstSeen = 0;

  async function loadDetector() {
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
    const options = { runningMode: 'VIDEO', minDetectionConfidence: .4 };
    try {
      return await vision.FaceDetector.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' } });
    } catch {
      return vision.FaceDetector.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' } });
    }
  }

  function report(next) {
    if (next === present) return;
    present = next;
    onPresence?.(present);
  }

  async function grab() {
    if (capture) {
      try { return await capture.grabFrame(); } catch { capture = null; }
    }
    if (video && video.readyState >= 2) return video;
    return null;
  }

  async function check() {
    if (busy || !stream) return;
    busy = true;
    try {
      const frame = await grab();
      if (!frame || !stream) return;
      const now = performance.now();
      const detections = detector.detectForVideo(frame, now).detections;
      const width = frame.videoWidth || frame.width, height = frame.videoHeight || frame.height;
      onSample?.({ frame, detections, width, height });
      if (frame.close) frame.close();
      const found = detections.length > 0;
      if (now - startedAt < WARM_UP) { if (found) lastSeen = now; return; }
      if (found) {
        if (!firstSeen) firstSeen = now;
        lastSeen = now;
        if (!present && now - firstSeen >= BACK_AFTER) report(true);
      } else {
        firstSeen = 0;
        if (present && now - lastSeen >= AWAY_AFTER) report(false);
      }
    } catch (error) {
      console.warn('Face check failed', error);
    } finally { busy = false; }
  }

  async function start() {
    if (stream) return true;
    try {
      detector ||= await loadDetector();
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      [track] = stream.getVideoTracks();
      capture = 'ImageCapture' in window ? new ImageCapture(track) : null;
      // 备用取帧：隐藏的 <video> 挂在页面上（脱离页面的 video 在部分浏览器里不会更新画面）。
      video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true, srcObject: stream });
      Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' });
      document.body.append(video);
      await video.play().catch(() => {});
      startedAt = lastSeen = performance.now(); firstSeen = 0; present = true;
      timer = setInterval(check, CHECK_EVERY);
      return true;
    } catch (error) {
      console.warn('Face detection unavailable', error);
      stop();
      onError?.(error);
      return false;
    }
  }

  function stop() {
    clearInterval(timer); timer = 0;
    stream?.getTracks().forEach(t => t.stop());
    stream = track = capture = null;
    if (video) { video.srcObject = null; video.remove(); video = null; }
    report(true);
  }

  return { start, stop, get running() { return !!stream; }, get present() { return present; } };
}
