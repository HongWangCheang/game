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
  const dayKey = ms => { const d = new Date(ms); return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const localDate = (year, month, day) => { const date = new Date(0); date.setFullYear(year, month, day); date.setHours(0, 0, 0, 0); return date; };
  const dateFromKey = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number), date = localDate(year, month - 1, day);
    return dayKey(date.getTime()) === value ? date : null;
  };
  const addSubjectValue = '__add_subject__';
  const manageSubjectValue = '__manage_subjects__';
  const isSubjectAction = value => [addSubjectValue, manageSubjectValue].includes(subjectKey(String(value)));
  const unclassifiedId = 'unclassified';
  const normalizeSubject = value => value.trim().replace(/\s+/gu, ' ');
  const subjectKey = value => normalizeSubject(value).normalize('NFKC').toLowerCase();
  const defaultSubjects = Array.from($('subject-select')?.options || []).filter(option => !isSubjectAction(option.value)).map(option => ({value: option.value, label: option.textContent}));
  const cleanSubject = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
  const selectedSubject = value => {
    const select = $('subject-select');
    if (isSubjectAction(value)) return '';
    const entry = findCatalog(value);
    if (entry) return !entry.deleted || hasSession() ? entry.value : '';
    return '';
  };
  const subjectLabel = () => {
    if (!subject) return '';
    return findCatalog(subject)?.label || cleanSubject(subject);
  };
  let storageAvailable = true, saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageAvailable = false; }
  let records = [], elapsed = 0, startedAt = null, firstStartedAt = null, segments = [];
  let dailyTotals = Object.create(null), customSubjects = [];
  let subjectCatalog = Object.create(null), subjectDailyTotals = Object.create(null), catalogAliases = new Map();
  let catalogRevision = 0, subjectTotalsRevision = 0, managerCache = '', statsScope = 'all', statsCache = '', statsCompleted = new Map(), statsOrder = null;
  const managerButtons = new Map(), statsRows = new Map();
  let mode = 'stopwatch', pomodoroMinutes = 25, subject = '';
  let status = 'idle', view = 'focus', recordsRevision = 0, recordsCache = '';
  let toastTimeout, deadlineTimeout;
  const todayDate = new Date();
  let calendarMonth = localDate(todayDate.getFullYear(), todayDate.getMonth(), 1);
  let calendarSelected = dayKey(Date.now()), calendarGridKey = '';
  const calendarButtons = new Map();
  const hasSession = () => status !== 'idle';
  const targetDuration = () => mode === 'pomodoro' ? pomodoroMinutes * 60000 : Infinity;
  const rawElapsed = (now = Date.now()) => elapsed + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  const currentElapsed = (now = Date.now()) => Math.min(targetDuration(), rawElapsed(now));
  function findCatalog(value) {
    if (typeof value !== 'string' || !value || isSubjectAction(value)) return null;
    const id = catalogAliases.get(subjectKey(value));
    return id ? subjectCatalog[id] : null;
  }
  function ensureCatalog(value, label = value, custom = true) {
    if (typeof value !== 'string') return null;
    value = normalizeSubject(value); label = typeof label === 'string' ? normalizeSubject(label) : value;
    if (!value || isSubjectAction(value) || Array.from(value).length > 80) return null;
    const known = findCatalog(value);
    if (known) return known;
    const id = `subject:${subjectKey(value)}`;
    const entry = {id, value, label: custom ? value : cleanSubject(label) || value, custom, deleted: false};
    subjectCatalog[id] = entry; catalogAliases.set(subjectKey(value), id);
    if (!custom && label) catalogAliases.set(subjectKey(label), id);
    catalogRevision++;
    return entry;
  }
  function refreshSubjectOptions() {
    const select = $('subject-select');
    const entries = Object.values(subjectCatalog), currentId = findCatalog(subject)?.id;
    customSubjects = entries.filter(entry => entry.custom).map(entry => entry.value);
    if (!select) return;
    const makeOption = (value, label) => { const option = document.createElement('option'); option.value = value; option.textContent = label; return option; };
    const placeholder = defaultSubjects.find(option => !option.value)?.label || '选择学习科目';
    const options = entries.filter(entry => !entry.deleted || hasSession() && entry.id === currentId).map(entry => {
      const option = makeOption(entry.value, entry.label); option.disabled = entry.deleted; return option;
    });
    select.replaceChildren(makeOption('', placeholder), ...options, makeOption(addSubjectValue, '+ 添加学习科目…'));
    select.value = subject;
  }
  function hydrateSubjects(data) {
    subjectCatalog = Object.create(null); catalogAliases = new Map(); catalogRevision++;
    for (const option of defaultSubjects) if (option.value) ensureCatalog(option.value, option.label, false);
    if (data?.subjectCatalog && typeof data.subjectCatalog === 'object' && !Array.isArray(data.subjectCatalog)) {
      for (const stored of Object.values(data.subjectCatalog)) {
        if (!stored || typeof stored.value !== 'string') continue;
        const entry = ensureCatalog(stored.value, stored.label, stored.custom !== false);
        if (entry) entry.deleted = stored.deleted === true;
      }
    }
    if (Array.isArray(data?.customSubjects)) for (const value of data.customSubjects) ensureCatalog(value);
    if (data?.subject) ensureCatalog(cleanSubject(data.subject));
    refreshSubjectOptions();
  }
  const currentSubjectId = () => findCatalog(subject)?.id || unclassifiedId;
  function recordSubjectId(record) {
    if (record.subjectId === unclassifiedId) return unclassifiedId;
    if (typeof record.subjectId === 'string' && record.subjectId.startsWith('subject:')) {
      const value = record.subjectId.slice(8), entry = ensureCatalog(value);
      if (entry) return entry.id;
    }
    return ensureCatalog(cleanSubject(record.subject))?.id || unclassifiedId;
  }
  function subjectBucket(id, label) {
    if (!subjectDailyTotals[id]) subjectDailyTotals[id] = {label: id === unclassifiedId ? '未分类' : label || subjectCatalog[id]?.label || id.slice(8), days: Object.create(null)};
    return subjectDailyTotals[id];
  }
  function loadSubjectTotals(data, existingRecords) {
    subjectDailyTotals = Object.create(null);
    if (data?.subjectDailyTotals && typeof data.subjectDailyTotals === 'object' && !Array.isArray(data.subjectDailyTotals)) {
      for (const [savedId, stored] of Object.entries(data.subjectDailyTotals)) {
        if (!stored || !stored.days || typeof stored.days !== 'object' || Array.isArray(stored.days)) continue;
        const id = savedId === unclassifiedId ? unclassifiedId : recordSubjectId({subjectId: savedId, subject: stored.label});
        const bucket = subjectBucket(id, cleanSubject(stored.label));
        for (const [date, value] of Object.entries(stored.days)) if (dateFromKey(date) && Number.isFinite(value) && value >= 0) addDuration(bucket.days, date, value);
      }
    }
    if (data?.subjectDailyTotalsVersion !== 1) {
      const seeded = Object.create(null);
      for (const record of existingRecords) {
        const id = recordSubjectId(record);
        if (!seeded[id]) seeded[id] = Object.create(null);
        for (const [date, value] of Object.entries(distributeRecord(record))) addDuration(seeded[id], date, value);
      }
      for (const [id, days] of Object.entries(seeded)) {
        const bucket = subjectBucket(id);
        for (const [date, value] of Object.entries(days)) bucket.days[date] = Math.max(bucket.days[date] || 0, value);
      }
    }
    const attributed = Object.create(null);
    for (const bucket of Object.values(subjectDailyTotals)) for (const [date, value] of Object.entries(bucket.days)) addDuration(attributed, date, value);
    for (const [date, value] of Object.entries(dailyTotals)) if (value > (attributed[date] || 0)) addDuration(subjectBucket(unclassifiedId).days, date, value - (attributed[date] || 0));
    subjectTotalsRevision++;
  }
  function addDuration(totals, date, duration) {
    if (duration > 0) totals[date] = (totals[date] || 0) + duration;
  }
  function distributeRecord(record) {
    const totals = Object.create(null);
    let remaining = record.duration;
    for (const segment of Array.isArray(record.segments) ? record.segments.filter(validSegment) : []) {
      let cursor = segment.start;
      while (cursor < segment.end && remaining > 0) {
        const date = new Date(cursor), midnight = localDate(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
        const end = Math.min(segment.end, midnight, cursor + remaining), duration = end - cursor;
        if (duration <= 0) break;
        addDuration(totals, dayKey(cursor), duration); remaining -= duration; cursor = end;
      }
    }
    // Old records may have no segments; retain their duration on the completion day.
    addDuration(totals, dayKey(record.endedAt), remaining);
    return totals;
  }
  function loadDailyTotals(data, existingRecords) {
    dailyTotals = Object.create(null);
    if (data?.dailyTotals && typeof data.dailyTotals === 'object' && !Array.isArray(data.dailyTotals)) {
      for (const [date, value] of Object.entries(data.dailyTotals)) if (dateFromKey(date) && Number.isFinite(value) && value >= 0) dailyTotals[date] = value;
    }
    if (data?.dailyTotalsVersion === 1) return;
    const seeded = Object.create(null);
    for (const record of existingRecords) for (const [date, duration] of Object.entries(distributeRecord(record))) addDuration(seeded, date, duration);
    // An unversioned map may already contain these records. Preserve the larger known total.
    for (const [date, duration] of Object.entries(seeded)) dailyTotals[date] = Math.max(dailyTotals[date] || 0, duration);
  }
  function activeDailyTotals(now = Date.now()) {
    if (!hasSession()) return Object.create(null);
    const end = startedAt === null ? null : Math.max(startedAt, Math.min(now, startedAt + Math.max(0, targetDuration() - elapsed)));
    const activeSegments = end === null ? segments : [...segments, {start: startedAt, end}];
    return distributeRecord({duration: currentElapsed(now), segments: activeSegments, endedAt: end ?? segments[segments.length - 1]?.end ?? firstStartedAt ?? now});
  }
  function loadState(data) {
    const now = Date.now();
    const existingRecords = Array.isArray(data?.records) ? data.records.filter(validRecord) : [];
    records = existingRecords.slice(0, 200);
    loadDailyTotals(data, existingRecords);
    elapsed = Number.isFinite(data?.elapsed) && data.elapsed >= 0 ? data.elapsed : 0;
    startedAt = validTime(data?.startedAt) && data.startedAt <= now ? data.startedAt : null;
    firstStartedAt = validTime(data?.firstStartedAt) ? data.firstStartedAt : null;
    segments = Array.isArray(data?.segments) ? data.segments.filter(validSegment) : [];
    mode = data?.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
    pomodoroMinutes = validMinutes(data?.pomodoroMinutes) ? data.pomodoroMinutes : 25;
    subject = cleanSubject(data?.subject);
    if (firstStartedAt === null && (startedAt !== null || elapsed > 0)) firstStartedAt = startedAt ?? now;
    status = startedAt !== null ? 'running' : firstStartedAt !== null || elapsed > 0 ? 'paused' : 'idle';
    hydrateSubjects(data);
    loadSubjectTotals(data, existingRecords);
    subject = selectedSubject(subject);
    refreshSubjectOptions();
    recordsRevision++;
  }
  loadState(saved);
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({records, elapsed, startedAt, firstStartedAt, segments, mode, pomodoroMinutes, subject, customSubjects, dailyTotals, dailyTotalsVersion: 1, subjectCatalog, subjectDailyTotals, subjectDailyTotalsVersion: 1}));
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
  function calendarDuration(ms, compact = false) {
    if (ms > 0 && ms < 1000) return '不足 1 秒';
    const total = Math.floor(ms / 1000), hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, seconds = total % 60;
    if (compact) return hours ? `${hours}时${minutes ? `${minutes}分` : ''}` : minutes ? `${minutes}分` : `${seconds}秒`;
    return [hours ? `${hours} 小时` : '', hours || minutes ? `${minutes} 分钟` : '', `${seconds} 秒`].filter(Boolean).join(' ');
  }
  function renderSubjectStats(now = Date.now()) {
    const list = $('subject-stats-list');
    if (!list) return;
    const today = dayKey(now), cache = `${subjectTotalsRevision}:${statsScope}:${today}`;
    if (cache !== statsCache) {
      statsCache = cache; statsCompleted = new Map();
      for (const [id, bucket] of Object.entries(subjectDailyTotals)) statsCompleted.set(id, statsScope === 'today' ? bucket.days[today] || 0 : Object.values(bucket.days).reduce((sum, value) => sum + value, 0));
    }
    const values = new Map(statsCompleted), currentId = currentSubjectId();
    if (hasSession()) {
      const days = activeDailyTotals(now), active = statsScope === 'today' ? days[today] || 0 : Object.values(days).reduce((sum, value) => sum + value, 0);
      values.set(currentId, (values.get(currentId) || 0) + active);
    }
    for (const entry of Object.values(subjectCatalog)) if (!entry.deleted && !values.has(entry.id)) values.set(entry.id, 0);
    const labelFor = id => id === unclassifiedId ? '未分类' : subjectCatalog[id]?.label || subjectDailyTotals[id]?.label || id.slice(8);
    const ids = [...values.keys()].filter(id => (values.get(id) || 0) > 0 || (id === unclassifiedId ? hasSession() && currentId === id : subjectCatalog[id] && !subjectCatalog[id].deleted)).sort((a, b) => labelFor(a).localeCompare(labelFor(b), 'zh-CN') || a.localeCompare(b));
    const total = ids.reduce((sum, id) => sum + (values.get(id) || 0), 0);
    text('subject-stats-total', calendarDuration(total)); text('subject-stats-count', String(ids.length));
    for (const name of ['all', 'today']) {
      const active = statsScope === name; $(`subject-stats-${name}`)?.classList.toggle('active', active);
      $(`subject-stats-${name}`)?.setAttribute('aria-pressed', String(active)); $(`subject-stats-${name}`)?.setAttribute('aria-selected', String(active));
    }
    for (const id of ids) {
      if (!statsRows.has(id)) {
        const row = document.createElement('div'); row.className = 'subject-stat-row'; row.dataset.subjectId = id;
        const heading = document.createElement('div'); heading.className = 'subject-stat-name';
        const name = document.createElement('span');
        const status = document.createElement('span'); status.className = 'subject-stat-status';
        heading.append(name, status);
        const duration = document.createElement('span'); duration.className = 'subject-stat-duration';
        const share = document.createElement('span'); share.className = 'subject-stat-share';
        const bar = document.createElement('div'); bar.className = 'subject-stat-bar'; bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span'); fill.className = 'subject-stat-fill'; bar.append(fill);
        row.append(heading, duration, bar, share); statsRows.set(id, {row, name, status, duration, share, fill});
      }
      const nodes = statsRows.get(id), value = values.get(id) || 0, deleted = subjectCatalog[id]?.deleted === true;
      const stateLabel = deleted ? '已删除' : hasSession() && currentId === id ? status === 'paused' ? '本次已暂停' : '本次学习中' : '';
      const percent = total > 0 ? Math.round(value / total * 1000) / 10 : 0;
      const update = (node, value) => { if (node.textContent !== value) node.textContent = value; };
      update(nodes.name, labelFor(id)); update(nodes.duration, calendarDuration(value)); update(nodes.share, `${percent}%`); update(nodes.status, stateLabel);
      nodes.status.hidden = !stateLabel; nodes.fill.style.width = `${percent}%`;
    }
    const order = JSON.stringify(ids);
    if (order !== statsOrder) {
      statsOrder = order;
      if (ids.length) list.replaceChildren(...ids.map(id => statsRows.get(id).row));
      else { const empty = document.createElement('p'); empty.className = 'subject-stats-empty'; empty.textContent = '还没有科目时长，添加科目开始积累吧。'; list.replaceChildren(empty); }
    }
  }
  function changeSubjectVisibility(id, restore) {
    const entry = subjectCatalog[id];
    if (!entry) return;
    if (!restore && hasSession() && currentSubjectId() === id) { text('subjects-message', '请先结束本次学习，再删除当前科目。历史记录和时长会保留。'); return; }
    entry.deleted = !restore; catalogRevision++;
    if (!restore && findCatalog(subject)?.id === id && !hasSession()) subject = '';
    refreshSubjectOptions(); persist(); render();
    text('subjects-message', restore ? `已恢复「${entry.label}」，原有记录和时长仍然保留。` : `已删除「${entry.label}」的选择项，历史记录和时长会保留，可随时恢复。`);
  }
  function renderSubjectManager() {
    if (!$('subjects-dialog')?.open) return;
    const entries = Object.values(subjectCatalog), archived = entries.filter(entry => entry.deleted);
    if ($('subjects-archived-section')) $('subjects-archived-section').hidden = archived.length === 0;
    if (managerCache !== String(catalogRevision)) {
      managerCache = String(catalogRevision); managerButtons.clear();
      for (const deleted of [false, true]) {
        const list = $(deleted ? 'subjects-archived-list' : 'subjects-active-list');
        if (!list) continue;
        const rows = entries.filter(entry => entry.deleted === deleted).map(entry => {
          const row = document.createElement('div'); row.className = 'subject-manage-row'; row.dataset.subjectId = entry.id;
          const name = document.createElement('span'); name.className = 'subject-manage-name'; name.textContent = entry.label;
          const button = document.createElement('button'); button.type = 'button'; button.className = deleted ? 'subject-restore-button' : 'subject-delete-button'; button.textContent = deleted ? '恢复' : '删除';
          button.setAttribute('aria-label', `${deleted ? '恢复' : '删除'}科目 ${entry.label}`);
          button.addEventListener('click', () => changeSubjectVisibility(entry.id, deleted));
          row.append(name, button); managerButtons.set(entry.id, button); return row;
        });
        if (rows.length) list.replaceChildren(...rows);
        else { const message = document.createElement('p'); message.className = 'subject-manage-empty'; message.textContent = deleted ? '暂无已删除科目。' : '还没有可选科目，可以添加自己的学习科目。'; list.replaceChildren(message); }
      }
    }
    for (const entry of entries) {
      const button = managerButtons.get(entry.id);
      if (!button) continue;
      button.disabled = !entry.deleted && hasSession() && entry.id === currentSubjectId();
      button.title = button.disabled ? '本次学习结束后可以删除当前科目，历史时长会保留' : entry.deleted ? '恢复此科目，原有时长会保留' : '隐藏此科目，历史记录和时长会保留';
    }
    if ($('subjects-add-button')) $('subjects-add-button').disabled = hasSession();
  }
  function openSubjectManager() {
    if ($('subject-select')) $('subject-select').value = subject;
    text('subjects-message', hasSession() ? '当前学习科目需结束后才能删除。其他科目的历史记录和时长会保留。' : '删除科目只隐藏选择项，历史记录和时长会保留，可随时恢复。');
    if (!$('subjects-dialog')?.open) $('subjects-dialog')?.showModal();
    renderSubjectManager();
  }
  function buildCalendarGrid() {
    const grid = $('calendar-grid');
    if (!grid) return;
    const monthKey = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`;
    if (monthKey === calendarGridKey) return;
    calendarGridKey = monthKey; calendarButtons.clear();
    const offset = (calendarMonth.getDay() + 6) % 7;
    const start = localDate(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - offset);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = localDate(start.getFullYear(), start.getMonth(), start.getDate() + i), dateKey = dayKey(date.getTime());
      const button = document.createElement('button'); button.type = 'button'; button.className = 'calendar-day'; button.dataset.date = dateKey;
      button.classList.toggle('is-outside', date.getMonth() !== calendarMonth.getMonth());
      const number = document.createElement('span'); number.className = 'calendar-day-number'; number.textContent = String(date.getDate());
      const duration = document.createElement('span'); duration.className = 'calendar-day-duration';
      button.append(number, duration);
      button.addEventListener('click', () => {
        calendarSelected = dateKey;
        const outside = date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear();
        if (outside) calendarMonth = localDate(date.getFullYear(), date.getMonth(), 1);
        renderCalendar();
        if (outside) calendarButtons.get(dateKey)?.button.focus();
      });
      calendarButtons.set(dateKey, {button, duration, date}); cells.push(button);
    }
    grid.replaceChildren(...cells);
  }
  function renderCalendar(now = Date.now()) {
    if (!$('calendar-dialog')?.open) return;
    buildCalendarGrid();
    const active = activeDailyTotals(now), totals = Object.assign(Object.create(null), dailyTotals);
    for (const [date, duration] of Object.entries(active)) addDuration(totals, date, duration);
    const today = dayKey(now), fullDate = new Intl.DateTimeFormat('zh-CN', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'});
    text('calendar-month', new Intl.DateTimeFormat('zh-CN', {year: 'numeric', month: 'long'}).format(calendarMonth));
    for (const [dateKey, {button, duration, date}] of calendarButtons) {
      const value = totals[dateKey] || 0, selected = dateKey === calendarSelected;
      const label = `${fullDate.format(date)}，学习 ${calendarDuration(value)}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.getAttribute('aria-pressed') !== String(selected)) button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-current', dateKey === today ? 'date' : 'false');
      button.classList.toggle('is-today', dateKey === today); button.classList.toggle('is-selected', selected); button.classList.toggle('has-study', value > 0);
      const compact = value > 0 ? calendarDuration(value, true) : '—';
      if (duration.textContent !== compact) duration.textContent = compact;
    }
    const selectedDate = dateFromKey(calendarSelected), selectedTotal = totals[calendarSelected] || 0;
    if (selectedDate) text('calendar-selected-date', fullDate.format(selectedDate));
    text('calendar-day-total', calendarDuration(selectedTotal));
    text('calendar-day-note', active[calendarSelected] > 0 ? '包含本次尚未结束的学习时长。' : selectedTotal > 0 ? '已完成的学习时长已保存在此设备。' : '这一天还没有学习记录，慢慢积累就好。');
    const monthPrefix = dayKey(calendarMonth.getTime()).slice(0, 7);
    const monthTotal = Object.entries(totals).reduce((sum, [date, value]) => sum + (date.startsWith(`${monthPrefix}-`) ? value : 0), 0);
    text('calendar-month-total', calendarDuration(monthTotal));
  }
  function showCalendarToday() {
    const today = new Date(); calendarMonth = localDate(today.getFullYear(), today.getMonth(), 1); calendarSelected = dayKey(today.getTime());
    renderCalendar();
  }
  function moveCalendarMonth(direction) {
    const selected = dateFromKey(calendarSelected), day = selected?.getDate() || 1;
    calendarMonth = localDate(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1);
    const lastDay = localDate(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    calendarSelected = dayKey(localDate(calendarMonth.getFullYear(), calendarMonth.getMonth(), Math.min(day, lastDay)).getTime());
    renderCalendar();
  }
  function closeSubjectDialog() {
    if ($('subject-select')) $('subject-select').value = subject;
    $('subject-dialog')?.close();
  }
  function openSubjectDialog() {
    if ($('subject-select')) $('subject-select').value = subject;
    if (hasSession()) return;
    text('subject-error', '');
    if ($('subject-name')) { $('subject-name').value = ''; $('subject-name').setCustomValidity(''); }
    if (!$('subject-dialog')?.open) $('subject-dialog')?.showModal();
    $('subject-name')?.focus();
  }
  function stat(id, value, unit) {
    const node = $(id);
    if (!node || node.dataset.value === String(value)) return;
    node.dataset.value = String(value);
    node.replaceChildren(document.createTextNode(String(value)), Object.assign(document.createElement('span'), {textContent: ` ${unit}`}));
  }
  function renderRecords(now = Date.now()) {
    const today = dayKey(now), date = new Date(now);
    const completed = dailyTotals[today] || 0, activeToday = activeDailyTotals(now)[today] || 0;
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
    document.title = status === 'running' ? `${display} · 萌宠监管学习中` : '萌宠监管 · 学习计时';
    renderRecords(now);
    renderCalendar(now);
    renderSubjectStats(now);
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
    if ($('subject-select')) { $('subject-select').disabled = locked; $('subject-select').value = subject; $('subject-select').title = locked ? '本次学习结束后可以更换或添加科目' : '选择科目，或在列表末尾添加自己的科目'; }
    if ($('pomodoro-minutes')) { $('pomodoro-minutes').disabled = locked; $('pomodoro-minutes').value = String(pomodoroMinutes); }
    const saveSettings = $('settings-form')?.querySelector('[type="submit"]');
    if (saveSettings) saveSettings.disabled = locked;
    if ($('subject-name')) $('subject-name').disabled = locked;
    const saveSubject = $('subject-form')?.querySelector('[type="submit"]');
    if (saveSubject) saveSubject.disabled = locked;
    renderNavigation(); renderSubjectManager(); scheduleDeadline();
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
      const record = {duration, firstStartedAt: firstStartedAt ?? at, endedAt: at, segments, subject: subjectLabel(), subjectId: currentSubjectId(), mode};
      const bucket = subjectBucket(record.subjectId, record.subject);
      for (const [date, value] of Object.entries(distributeRecord(record))) { addDuration(dailyTotals, date, value); addDuration(bucket.days, date, value); }
      subjectTotalsRevision++;
      records.unshift(record);
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
    if ($('subject-select').value === addSubjectValue) { openSubjectDialog(); return; }
    if ($('subject-select').value === manageSubjectValue) { openSubjectManager(); return; }
    if (!hasSession()) { subject = selectedSubject($('subject-select').value); persist(); }
    render();
  });
  for (const id of ['subject-close', 'subject-cancel']) on(id, 'click', event => { event.preventDefault(); closeSubjectDialog(); });
  on('subject-dialog', 'cancel', () => closeSubjectDialog());
  on('subject-dialog', 'close', () => { if ($('subject-select')) $('subject-select').value = subject; });
  on('subject-name', 'input', () => { text('subject-error', ''); $('subject-name').setCustomValidity(''); });
  on('subject-name', 'invalid', () => text('subject-error', '请输入 1 到 30 个字的科目名称。'));
  on('subject-form', 'submit', event => {
    event.preventDefault();
    if (hasSession()) { text('subject-error', '请先结束当前学习，再添加科目。'); return; }
    const name = normalizeSubject($('subject-name')?.value || '');
    if (!name || Array.from(name).length > 30 || isSubjectAction(name)) {
      const message = !name ? '请输入科目名称。' : Array.from(name).length > 30 ? '科目名称最多 30 个字。' : '请换一个科目名称。';
      text('subject-error', message); $('subject-name')?.setCustomValidity(message); $('subject-name')?.reportValidity(); return;
    }
    const duplicate = findCatalog(name), wasDeleted = duplicate?.deleted;
    const entry = duplicate || ensureCatalog(name);
    if (!entry) return;
    entry.deleted = false; subject = entry.value; catalogRevision++; refreshSubjectOptions();
    persist(); render(); closeSubjectDialog();
    const message = wasDeleted ? `已恢复科目「${subjectLabel()}」，原有时长仍然保留。` : duplicate ? `已选择已有科目「${subjectLabel()}」。` : `已添加科目「${subjectLabel()}」。`;
    say(message); if (duplicate) toast(message);
  });
  for (const id of ['manage-subjects-button', 'records-manage-subjects']) on(id, 'click', () => openSubjectManager());
  on('subjects-close', 'click', event => { event.preventDefault(); $('subjects-dialog')?.close(); });
  on('subjects-add-button', 'click', () => { if (hasSession()) return; $('subjects-dialog')?.close(); openSubjectDialog(); });
  for (const scope of ['all', 'today']) on(`subject-stats-${scope}`, 'click', () => { statsScope = scope; renderSubjectStats(); });
  on('calendar-button', 'click', () => { if (!$('calendar-dialog')?.open) $('calendar-dialog')?.showModal(); showCalendarToday(); });
  on('calendar-close', 'click', event => { event.preventDefault(); $('calendar-dialog')?.close(); });
  on('calendar-prev', 'click', () => moveCalendarMonth(-1));
  on('calendar-next', 'click', () => moveCalendarMonth(1));
  on('calendar-today', 'click', () => showCalendarToday());
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
