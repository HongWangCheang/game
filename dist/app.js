(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'senli-study-v1';
  let saved;
  let storageAvailable = true;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageAvailable = false; }
  const validRecord = r => r && Number.isFinite(r.duration) && r.duration >= 0 && Number.isFinite(r.endedAt) && Number.isFinite(r.firstStartedAt);
  let records = Array.isArray(saved?.records) ? saved.records.filter(validRecord).slice(0, 200) : [];
  let elapsed = Number.isFinite(saved?.elapsed) && saved.elapsed >= 0 ? saved.elapsed : 0;
  let startedAt = Number.isFinite(saved?.startedAt) && saved.startedAt <= Date.now() ? saved.startedAt : null;
  let firstStartedAt = Number.isFinite(saved?.firstStartedAt) ? saved.firstStartedAt : null;
  const validSegment = s => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end >= s.start;
  let segments = Array.isArray(saved?.segments) ? saved.segments.filter(validSegment) : [];
  let status = startedAt !== null ? 'running' : elapsed > 0 ? 'paused' : 'idle';
  let toastTimeout;
  const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const currentElapsed = () => elapsed + (startedAt === null ? 0 : Math.max(0, Date.now() - startedAt));
  const formatClock = ms => { const seconds = Math.floor(ms / 1000); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':'); };
  const formatDuration = ms => { const s = Math.floor(ms / 1000); if(s < 60) return `${s} 秒`; const m = Math.floor(s / 60); return `${m} 分钟${s % 60 ? ` ${s % 60} 秒` : ''}`; };
  function persist() {
    try { localStorage.setItem(key, JSON.stringify({records, elapsed, startedAt, firstStartedAt, segments})); }
    catch { storageAvailable = false; }
    $('storage-note').textContent = storageAvailable ? '记录保存在此设备' : '本次记录暂存于当前页面';
  }
  function say(text) { $('announcement').textContent = text; }
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3600); }
  function renderRecords() {
    const today = dayKey(Date.now());
    const todayRecords = records.filter(r => dayKey(r.endedAt) === today);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).getTime();
    const todayPortion = list => list.filter(validSegment).reduce((sum, s) => sum + Math.max(0, Math.min(s.end, dayEnd) - Math.max(s.start, dayStart)), 0);
    const completed = records.reduce((sum, r) => sum + (Array.isArray(r.segments) ? todayPortion(r.segments) : dayKey(r.endedAt) === today ? r.duration : 0), 0);
    const currentToday = todayPortion(segments) + (startedAt === null ? 0 : todayPortion([{start:startedAt,end:Date.now()}]));
    const totalMinutes = Math.floor((completed + currentToday) / 60000);
    $('today-total').replaceChildren(document.createTextNode(String(totalMinutes)), Object.assign(document.createElement('span'), {textContent:' 分钟'}));
    $('today-count').replaceChildren(document.createTextNode(String(todayRecords.length)), Object.assign(document.createElement('span'), {textContent:' 次'}));
    $('date').textContent = new Intl.DateTimeFormat('zh-CN', {month:'long',day:'numeric',weekday:'long'}).format(new Date());
    if(!records.length) return;
    $('sessions').replaceChildren(...records.slice(0,5).map(r => {
      const row = document.createElement('div'); row.className = 'session-row';
      const left = document.createElement('div'); left.className = 'session-left';
      const check = document.createElement('span'); check.className = 'session-check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
      const details = document.createElement('div');
      const label = document.createElement('div'); label.className = 'session-label'; label.textContent = '一段专注时光';
      const time = document.createElement('div'); time.className = 'session-time';
      const datePart = dayKey(r.endedAt) === today ? '今天' : new Intl.DateTimeFormat('zh-CN', {month:'numeric',day:'numeric'}).format(new Date(r.endedAt));
      const timeFormatter = new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
      time.textContent = `${datePart} · ${timeFormatter.format(new Date(r.firstStartedAt))} — ${timeFormatter.format(new Date(r.endedAt))}`;
      details.append(label,time); left.append(check,details);
      const duration = document.createElement('span'); duration.className = 'session-duration'; duration.textContent = formatDuration(r.duration);
      row.append(left,duration); return row;
    }));
  }
  function tick() {
    const value = currentElapsed();
    const time = formatClock(value);
    $('timer').textContent = time;
    $('timer').setAttribute('aria-label', `本次学习时长 ${time}`);
    document.title = status === 'running' ? `${time} · 森里学习中` : '森里 · 学习计时';
    renderRecords();
  }
  function render() {
    const running = status === 'running';
    const paused = status === 'paused';
    $('forest').dataset.state = status;
    $('state-pill').textContent = running ? '专注中' : paused ? '已暂停' : '准备开始';
    $('state-pill').classList.toggle('running',running);
    $('speech').textContent = running ? '我醒啦，陪你一起学！' : paused ? '你休息，我也眯一会儿…' : '我先眯一会儿…';
    $('animal-status').textContent = running ? '小伙伴正在陪你学习' : '小伙伴正在休息';
    $('scene-icon').textContent = running ? '☀' : '☾';
    $('timer-kicker').textContent = paused ? '休息一下，随时继续' : '你的专注时光';
    $('timer-message').textContent = running ? '有它陪着，安心做眼前的事。' : paused ? '时间已暂停，继续时会接着累计。' : '开始计时，叫醒你的森林伙伴。';
    $('toggle-label').textContent = running ? '暂停学习' : paused ? '继续学习' : '开始学习';
    $('toggle').setAttribute('aria-label', $('toggle-label').textContent);
    $('play-icon').innerHTML = running ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="m9 5 10 7-10 7Z"/>';
    $('finish').disabled = status === 'idle';
    document.dispatchEvent(new CustomEvent('study:state',{detail:{status}}));
    tick();
  }
  function start() {
    if(status === 'running') return snapshot();
    startedAt = Date.now();
    if(firstStartedAt === null) firstStartedAt = startedAt;
    status = 'running'; persist(); render(); say('开始学习，小伙伴醒来了。'); return snapshot();
  }
  function pause() {
    if(status !== 'running') return snapshot();
    segments.push({start:startedAt,end:Math.max(startedAt,Date.now())});
    elapsed = currentElapsed(); startedAt = null; status = 'paused';
    persist(); render(); say('已暂停计时，小伙伴睡着了。'); return snapshot();
  }
  function finish() {
    if(status === 'idle') return snapshot();
    const duration = currentElapsed();
    if(startedAt !== null) segments.push({start:startedAt,end:Math.max(startedAt,Date.now())});
    if(duration >= 1000) records.unshift({duration,firstStartedAt:firstStartedAt ?? Date.now(),endedAt:Date.now(),segments});
    records = records.slice(0,200); elapsed = 0; startedAt = null; firstStartedAt = null; segments = []; status = 'idle';
    persist(); render(); const message = duration >= 1000 ? `已记下 ${formatDuration(duration)} 的专注。小伙伴去休息啦。` : '本次不足 1 秒，已结束计时。'; toast(message); say(message); return snapshot();
  }
  function snapshot() { return {status,elapsedSeconds:Math.floor(currentElapsed()/1000),completedSessions:records.length}; }
  $('toggle').addEventListener('click',() => status === 'running' ? pause() : start());
  $('finish').addEventListener('click',finish);
  document.addEventListener('visibilitychange',() => { if(!document.hidden) render(); });
  window.addEventListener('storage', event => {
    if(event.key !== key || !event.newValue) return;
    try {
      const latest = JSON.parse(event.newValue);
      if(!Array.isArray(latest.records) || !Number.isFinite(latest.elapsed) || latest.elapsed < 0) return;
      records = latest.records.filter(validRecord).slice(0,200); elapsed = latest.elapsed;
      startedAt = Number.isFinite(latest.startedAt) && latest.startedAt <= Date.now() ? latest.startedAt : null;
      firstStartedAt = Number.isFinite(latest.firstStartedAt) ? latest.firstStartedAt : null;
      segments = Array.isArray(latest.segments) ? latest.segments.filter(validSegment) : [];
      status = startedAt !== null ? 'running' : elapsed > 0 ? 'paused' : 'idle'; render();
    } catch {}
  });
  persist(); render(); setInterval(tick,500);
  const context = document.modelContext;
  if(context?.registerTool) {
    const lifecycle = new AbortController();
    const register = (name, description, readOnly, action) => {
      try { Promise.resolve(context.registerTool({name,description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:readOnly,untrustedContentHint:false},execute(input){if(!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.'); return action();}}, {signal:lifecycle.signal})).catch(() => {}); } catch {}
    };
    register('read_study_timer','Read current study timer state and elapsed seconds.',true,snapshot);
    register('start_study_timer','Start or resume learning; the animal wakes up.',false,start);
    register('pause_study_timer','Pause learning; the animal goes to sleep.',false,pause);
    register('finish_study_session','End the current session and save its duration on this device; the animal sleeps.',false,finish);
    window.addEventListener('pagehide',() => lifecycle.abort(),{once:true});
  }
})();
