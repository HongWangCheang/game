(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'senli-study-v1';
  const maxDate = 8640000000000000;
  const validTime = value => Number.isFinite(value) && Math.abs(value) <= maxDate;
  const validSegment = s => s && validTime(s.start) && validTime(s.end) && s.end >= s.start;
  const validRecord = r => r && Number.isFinite(r.duration) && r.duration >= 0 && validTime(r.endedAt) && validTime(r.firstStartedAt);
  const validMinutes = value => Number.isInteger(value) && value >= 5 && value <= 120;
  const text = (id, value) => { const node = $(id); if (node && node.textContent !== value) node.textContent = value; };
  const on = (id, event, action) => $(id)?.addEventListener(event, action);
  const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const cleanSubject = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
  const selectedSubject = value => {
    const select = $('subject-select');
    if (!select) return cleanSubject(value);
    return Array.from(select.options).some(option => option.value === value) ? value : select.value;
  };
  const subjectLabel = () => {
    if (!subject) return '';
    const select = $('subject-select');
    const option = select && Array.from(select.options).find(item => item.value === subject);
    return cleanSubject(option?.textContent || subject);
  };
  let storageAvailable = true, saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageAvailable = false; }
  let records = [], elapsed = 0, startedAt = null, firstStartedAt = null, segments = [];
  let mode = 'stopwatch', pomodoroMinutes = 25, subject = selectedSubject('');
  let status = 'idle', view = 'focus', recordsRevision = 0, recordsCache = '';
  let toastTimeout, deadlineTimeout;
  const hasSession = () => status !== 'idle';
  const targetDuration = () => mode === 'pomodoro' ? pomodoroMinutes * 60000 : Infinity;
  const rawElapsed = (now = Date.now()) => elapsed + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  const currentElapsed = (now = Date.now()) => Math.min(targetDuration(), rawElapsed(now));
  function loadState(data) {
    const now = Date.now();
    records = Array.isArray(data?.records) ? data.records.filter(validRecord).slice(0, 200) : [];
    elapsed = Number.isFinite(data?.elapsed) && data.elapsed >= 0 ? data.elapsed : 0;
    startedAt = validTime(data?.startedAt) && data.startedAt <= now ? data.startedAt : null;
    firstStartedAt = validTime(data?.firstStartedAt) ? data.firstStartedAt : null;
    segments = Array.isArray(data?.segments) ? data.segments.filter(validSegment) : [];
    mode = data?.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
    pomodoroMinutes = validMinutes(data?.pomodoroMinutes) ? data.pomodoroMinutes : 25;
    subject = selectedSubject(cleanSubject(data?.subject));
    if (firstStartedAt === null && (startedAt !== null || elapsed > 0)) firstStartedAt = startedAt ?? now;
    status = startedAt !== null ? 'running' : firstStartedAt !== null || elapsed > 0 ? 'paused' : 'idle';
    recordsRevision++;
  }
  loadState(saved);
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({records, elapsed, startedAt, firstStartedAt, segments, mode, pomodoroMinutes, subject}));
      storageAvailable = true;
    } catch { storageAvailable = false; }
    text('storage-note', storageAvailable ? '记录保存在此设备' : '本次记录暂存于当前页面');
  }
  function say(message) { text('announcement', message); }
  function toast(message) {
    text('toast', message); $('toast')?.classList.add('visible'); clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $('toast')?.classList.remove('visible'), 3600);
  }
  function formatClock(ms, roundUp = false) {
    const seconds = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':');
  }
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    return `${Math.floor(seconds / 60)} 分钟${seconds % 60 ? ` ${seconds % 60} 秒` : ''}`;
  }
  function stat(id, value, unit) {
    const node = $(id);
    if (!node || node.dataset.value === String(value)) return;
    node.dataset.value = String(value);
    node.replaceChildren(document.createTextNode(String(value)), Object.assign(document.createElement('span'), {textContent: ` ${unit}`}));
  }
  function renderRecords(now = Date.now()) {
    const today = dayKey(now), date = new Date(now);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const portion = list => list.filter(validSegment).reduce((sum, s) => sum + Math.max(0, Math.min(s.end, dayEnd) - Math.max(s.start, dayStart)), 0);
    const completed = records.reduce((sum, record) => {
      const hasSegments = Array.isArray(record.segments) && record.segments.some(validSegment);
      return sum + (hasSegments ? Math.min(record.duration, portion(record.segments)) : dayKey(record.endedAt) === today ? record.duration : 0);
    }, 0);
    const activeEnd = startedAt === null ? null : Math.min(now, startedAt + Math.max(0, targetDuration() - elapsed));
    const activeToday = portion(segments) + (activeEnd === null ? 0 : portion([{start: startedAt, end: activeEnd}]));
    stat('today-total', Math.floor((completed + activeToday) / 60000), '分钟');
    stat('today-count', records.filter(record => dayKey(record.endedAt) === today).length, '次');
    text('date', new Intl.DateTimeFormat('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'}).format(date));
    const cache = `${recordsRevision}:${today}`;
    if (cache === recordsCache || !$('sessions')) return;
    recordsCache = cache;
    if (!records.length) {
      const empty = document.createElement('div'); empty.className = 'empty-record';
      const icon = document.createElement('span'); icon.textContent = '◌'; icon.setAttribute('aria-hidden', 'true');
      const message = document.createElement('p'); message.textContent = '还没有完成的学习记录。开始你的第一段专注吧。';
      empty.append(icon, message); $('sessions').replaceChildren(empty); return;
    }
    const clock = new Intl.DateTimeFormat('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false});
    $('sessions').replaceChildren(...records.map(record => {
      const row = document.createElement('div'); row.className = 'session-row';
      const left = document.createElement('div'); left.className = 'session-left';
      const check = document.createElement('span'); check.className = 'session-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
      const details = document.createElement('div');
      const label = document.createElement('div'); label.className = 'session-label'; label.textContent = cleanSubject(record.subject) || '一段专注时光';
      const time = document.createElement('div'); time.className = 'session-time';
      const datePart = dayKey(record.endedAt) === today ? '今天' : new Intl.DateTimeFormat('zh-CN', {month: 'numeric', day: 'numeric'}).format(new Date(record.endedAt));
      time.textContent = `${datePart} · ${clock.format(new Date(record.firstStartedAt))} — ${clock.format(new Date(record.endedAt))}`;
      details.append(label, time); left.append(check, details);
      const duration = document.createElement('span'); duration.className = 'session-duration'; duration.textContent = formatDuration(record.duration);
      row.append(left, duration); return row;
    }));
  }
  function renderNavigation() {
    for (const name of ['focus', 'records']) {
      const active = view === name;
      if ($(`${name}-view`)) $(`${name}-view`).hidden = !active;
      $(`nav-${name}`)?.classList.toggle('active', active);
      $(`nav-${name}`)?.setAttribute('aria-pressed', String(active));
    }
  }
  function scheduleDeadline() {
    clearTimeout(deadlineTimeout);
    if (status !== 'running' || mode !== 'pomodoro') return;
    deadlineTimeout = setTimeout(() => { tick(); if (status === 'running') scheduleDeadline(); }, Math.max(0, targetDuration() - rawElapsed()));
  }
  function completeIfDue(now = Date.now()) {
    if (status !== 'running' || mode !== 'pomodoro' || rawElapsed(now) < targetDuration()) return false;
    finishSession(startedAt + Math.max(0, targetDuration() - elapsed), true);
    return true;
  }
  function tick() {
    const now = Date.now();
    if (completeIfDue(now)) return;
    const value = currentElapsed(now);
    const display = mode === 'pomodoro' ? formatClock(Math.max(0, targetDuration() - value), true) : formatClock(value);
    text('timer', display);
    $('timer')?.setAttribute('aria-live', 'off');
    $('timer')?.setAttribute('aria-label', `${mode === 'pomodoro' ? '本次专注剩余时间' : '本次学习时长'} ${display}`);
    document.title = status === 'running' ? `${display} · 森里学习中` : '森里 · 学习计时';
    renderRecords(now);
  }
  function render() {
    const running = status === 'running', paused = status === 'paused', locked = hasSession();
    if ($('forest')) $('forest').dataset.state = status;
    text('state-pill', running ? '专注中' : paused ? '已暂停' : '准备开始');
    $('state-pill')?.classList.toggle('running', running);
    text('speech', running ? '我醒啦，陪你一起学！' : paused ? '你休息，我也眯一会儿…' : '我先眯一会儿…');
    text('animal-status', running ? '小伙伴正在陪你学习' : paused ? '小伙伴正在休息' : '开始学习，唤醒你的森林伙伴');
    text('scene-icon', running ? '☀' : '☾');
    text('timer-kicker', mode === 'pomodoro' ? '番茄钟' : '正向计时');
    text('timer-message', paused ? '时间已暂停，继续时会接着累计。' : '每一分钟，都在慢慢积累');
    text('toggle-label', running ? '暂停学习' : paused ? '继续学习' : '开始学习');
    $('toggle')?.setAttribute('aria-label', running ? '暂停学习' : paused ? '继续学习' : '开始学习');
    if ($('play-icon')) $('play-icon').innerHTML = running ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="m9 5 10 7-10 7Z"/>';
    if ($('finish')) {
      $('finish').disabled = false;
      const label = locked ? '结束本次' : '重置';
      if ($('finish-label')) text('finish-label', label); else text('finish', label);
      $('finish').setAttribute('aria-label', label);
    }
    for (const name of ['stopwatch', 'pomodoro']) {
      const button = $(`mode-${name}`);
      if (!button) continue;
      button.disabled = locked; button.classList.toggle('active', mode === name);
      button.setAttribute('aria-pressed', String(mode === name));
      button.setAttribute('aria-selected', String(mode === name));
    }
    if ($('subject-select')) { $('subject-select').disabled = locked; $('subject-select').value = subject; }
    if ($('pomodoro-minutes')) { $('pomodoro-minutes').disabled = locked; $('pomodoro-minutes').value = String(pomodoroMinutes); }
    const saveSettings = $('settings-form')?.querySelector('[type="submit"]');
    if (saveSettings) saveSettings.disabled = locked;
    renderNavigation(); scheduleDeadline();
    document.dispatchEvent(new CustomEvent('study:state', {detail: {status}}));
    tick();
  }
  function start() {
    if (completeIfDue() || status === 'running') return snapshot();
    startedAt = Date.now();
    if (firstStartedAt === null) firstStartedAt = startedAt;
    status = 'running'; persist(); render(); say('开始学习，小伙伴醒来了。'); return snapshot();
  }
  function pause() {
    const now = Date.now();
    if (completeIfDue(now) || status !== 'running') return snapshot();
    segments.push({start: startedAt, end: Math.max(startedAt, now)});
    elapsed = currentElapsed(now); startedAt = null; status = 'paused';
    persist(); render(); say('已暂停计时，小伙伴睡着了。'); return snapshot();
  }
  function finishSession(at, automatic = false) {
    if (status === 'idle') return snapshot();
    const duration = currentElapsed(at);
    if (startedAt !== null) segments.push({start: startedAt, end: Math.max(startedAt, at)});
    if (duration >= 1000) {
      records.unshift({duration, firstStartedAt: firstStartedAt ?? at, endedAt: at, segments, subject: subjectLabel(), mode});
      records = records.slice(0, 200); recordsRevision++;
    }
    elapsed = 0; startedAt = null; firstStartedAt = null; segments = []; status = 'idle';
    persist(); render();
    const message = duration >= 1000 ? `${automatic ? '番茄钟完成！' : ''}已记下 ${formatDuration(duration)} 的专注。小伙伴去休息啦。` : '本次不足 1 秒，已结束计时。';
    toast(message); say(message); return snapshot();
  }
  function finish() {
    if (completeIfDue()) return snapshot();
    if (status === 'idle') { render(); return snapshot(); }
    return finishSession(Date.now());
  }
  function snapshot() {
    const value = currentElapsed();
    return {status, elapsedSeconds: Math.floor(value / 1000), completedSessions: records.length, mode, subject: subjectLabel(), remainingSeconds: mode === 'pomodoro' ? Math.ceil(Math.max(0, targetDuration() - value) / 1000) : null};
  }
  on('toggle', 'click', () => status === 'running' ? pause() : start());
  on('finish', 'click', () => finish());
  for (const name of ['stopwatch', 'pomodoro']) on(`mode-${name}`, 'click', () => {
    if (hasSession()) return;
    mode = name; persist(); render();
  });
  on('subject-select', 'change', () => {
    if (!hasSession()) { subject = selectedSubject($('subject-select').value); persist(); }
    render();
  });
  for (const name of ['focus', 'records']) on(`nav-${name}`, 'click', event => { event.preventDefault(); view = name; renderNavigation(); });
  on('settings-button', 'click', () => {
    if ($('pomodoro-minutes')) { $('pomodoro-minutes').value = String(pomodoroMinutes); $('pomodoro-minutes').setCustomValidity(''); }
    if (!$('settings-dialog')?.open) $('settings-dialog')?.showModal();
  });
  on('settings-close', 'click', event => { event.preventDefault(); $('settings-dialog')?.close(); });
  on('pomodoro-minutes', 'input', () => $('pomodoro-minutes').setCustomValidity(''));
  on('settings-form', 'submit', event => {
    event.preventDefault();
    if (hasSession()) return;
    const input = $('pomodoro-minutes'), value = Number(input?.value);
    if (!validMinutes(value)) { input?.setCustomValidity('请输入 5 到 120 之间的整数。'); input?.reportValidity(); return; }
    pomodoroMinutes = value; persist(); render(); $('settings-dialog')?.close(); say(`番茄钟已设为 ${value} 分钟。`);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('storage', event => {
    if (event.key !== key || !event.newValue) return;
    try {
      const latest = JSON.parse(event.newValue);
      if (!Array.isArray(latest?.records) || !Number.isFinite(latest.elapsed) || latest.elapsed < 0) return;
      loadState(latest); render();
    } catch {}
  });
  persist(); render(); setInterval(tick, 500);
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    const register = (name, description, readOnly, action) => {
      try {
        Promise.resolve(context.registerTool({name, description, inputSchema: {type: 'object', properties: {}, additionalProperties: false}, annotations: {readOnlyHint: readOnly, untrustedContentHint: false}, execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
          return action();
        }}, {signal: lifecycle.signal})).catch(() => {});
      } catch {}
    };
    register('read_study_timer', 'Read current study timer state and elapsed seconds.', true, snapshot);
    register('start_study_timer', 'Start or resume learning; the animal wakes up.', false, start);
    register('pause_study_timer', 'Pause learning; the animal goes to sleep.', false, pause);
    register('finish_study_session', 'End the current session and save its duration on this device; the animal sleeps.', false, finish);
    window.addEventListener('pagehide', () => lifecycle.abort(), {once: true});
  }
})();
