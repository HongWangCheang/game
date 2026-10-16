process.env.TZ = 'Australia/Melbourne';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../dist/app.js'), 'utf8');
const KEY = 'senli-study-v1';
const initialTime = new Date(2026, 9, 16, 12).getTime();

function boot(saved, at = initialTime) {
  let now = at, nextTimer = 1;
  const timeouts = new Map(), intervals = [], tools = new Map(), events = [], stored = new Map();
  if (saved) stored.set(KEY, JSON.stringify(saved));
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.listeners = {}; this._text = ''; this.value = ''; this.open = false; this.hidden = false; this.disabled = false; this.replacements = 0; this.classes = new Set(); this.classList = {add: name => this.classes.add(name), remove: name => this.classes.delete(name), toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name)}; }
    get options() { return this.children.length ? this.children : this._options || []; }
    set options(value) { this._options = value; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    emit(type, extra = {}) { const event = {preventDefault() {}, ...extra}; for (const callback of this.listeners[type] || []) callback(event); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; this.replacements++; }
    querySelector() { return submit; }
    setCustomValidity(value) { this.validityMessage = value; }
    reportValidity() { this.reportedInvalid = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    focus() { document.activeElement = this; }
  }
  const ids = ['storage-note','announcement','toast','today-total','today-count','date','sessions','timer','forest','state-pill','speech','animal-status','scene-icon','timer-kicker','timer-message','toggle-label','toggle','play-icon','finish','finish-label','mode-stopwatch','mode-pomodoro','subject-select','pomodoro-minutes','settings-form','settings-button','settings-dialog','settings-close','nav-focus','nav-records','focus-view','records-view','calendar-button','calendar-dialog','calendar-close','calendar-prev','calendar-next','calendar-today','calendar-month','calendar-grid','calendar-selected-date','calendar-day-total','calendar-day-note','calendar-month-total','subject-dialog','subject-close','subject-cancel','subject-form','subject-name','subject-error','subject-stats','subject-stats-list','subject-stats-total','subject-stats-count','subject-stats-all','subject-stats-today','manage-subjects-button','records-manage-subjects','subjects-dialog','subjects-close','subjects-active-list','subjects-archived-list','subjects-archived-section','subjects-add-button','subjects-message'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()])), submit = new Element();
  nodes['subject-select'].options = [{value: 'self-study', textContent: '自习'}, {value: 'math', textContent: '数学'}, {value: '其他', textContent: '其他学习'}];
  nodes['subject-select'].value = 'self-study';
  const listeners = {}, windowListeners = {};
  const document = {hidden: false, title: '', getElementById: id => nodes[id], createElement: tag => new Element(tag), createTextNode: value => { const n = new Element(); n.textContent = value; return n; }, addEventListener: (name, cb) => (listeners[name] ||= []).push(cb), dispatchEvent: event => { events.push(event); for (const callback of listeners[event.type] || []) callback(event); }, modelContext: {registerTool: definition => tools.set(definition.name, definition)}};
  class MockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const sandbox = {document, window: {addEventListener: (name, cb) => (windowListeners[name] ||= []).push(cb)}, localStorage: {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value)}, Date: MockDate, Intl, AbortController, CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}}, setInterval: callback => intervals.push(callback), setTimeout: (callback, ms) => {const id = nextTimer++; timeouts.set(id, {callback, at: now + ms}); return id;}, clearTimeout: id => timeouts.delete(id)};
  vm.runInNewContext(source, sandbox, {filename: 'subject-stats-app.js'});
  return {nodes, events, document, get now() {return now;}, saved: () => JSON.parse(stored.get(KEY)), click: id => nodes[id].emit('click'), tool: name => tools.get(name).execute({}), tick: () => intervals.forEach(callback => callback()), flushTimeouts() {for (const [id, task] of [...timeouts]) {if (task.at <= now) {timeouts.delete(id); task.callback();}}}, advance(ms, tick = true) {now += ms; if (tick) intervals.forEach(callback => callback());}, submitMinutes(value) {nodes['pomodoro-minutes'].value = String(value); nodes['settings-form'].emit('submit');}, storage(data) {for (const cb of windowListeners.storage || []) cb({key: KEY, newValue: JSON.stringify(data)});}, registered: tools};
}

let passed = 0;
function test(name, action) { action(); passed++; console.log('PASS ' + name); }

test('stopwatch excludes paused time, preserves subject and session locks, and saves segments', () => {
  const app = boot();
  assert.equal(app.nodes['animal-status'].textContent, '开始学习，唤醒你的森林伙伴');
  assert.equal(app.nodes['finish-label'].textContent, '重置');
  app.nodes['subject-select'].value = 'math'; app.nodes['subject-select'].emit('change');
  app.click('toggle'); app.advance(1250); app.click('toggle');
  assert.equal(app.nodes['forest'].dataset.state, 'paused');
  assert.equal(app.nodes['mode-pomodoro'].disabled, true);
  assert.equal(app.nodes['subject-select'].disabled, true);
  app.click('mode-pomodoro'); assert.equal(app.saved().mode, 'stopwatch');
  app.advance(5000); app.click('toggle'); app.advance(750); app.click('finish');
  const [record] = app.saved().records;
  assert.equal(record.duration, 2000); assert.equal(record.subject, '数学');
  assert.equal(record.segments.reduce((sum, s) => sum + s.end - s.start, 0), 2000);
  assert.equal(app.tool('read_study_timer').status, 'idle');
  app.click('finish'); assert.equal(app.saved().records.length, 1);
  assert.equal(app.nodes.finish.disabled, false);
});

test('default pomodoro finishes once at its exact deadline after a delayed callback', () => {
  const app = boot(); app.click('mode-pomodoro');
  assert.equal(app.nodes.timer.textContent, '00:25:00');
  app.click('toggle'); const began = app.now;
  app.advance(30 * 60000, false); app.tick();
  const record = app.saved().records[0];
  assert.equal(record.duration, 25 * 60000); assert.equal(record.endedAt, began + 25 * 60000);
  assert.equal(record.segments[0].end, record.endedAt);
  assert.equal(app.nodes.forest.dataset.state, 'idle');
  app.advance(60000); app.click('finish'); app.tick();
  assert.equal(app.saved().records.length, 1);
});

test('pomodoro pause/resume excludes inactive time and caps the final resumed segment', () => {
  const app = boot(); app.click('mode-pomodoro'); app.submitMinutes(5); app.click('toggle');
  app.advance(120000); app.click('toggle');
  app.advance(600000); assert.equal(app.saved().records.length, 0);
  assert.equal(app.nodes.timer.textContent, '00:03:00');
  app.click('toggle'); const resumed = app.now; app.advance(240000);
  const record = app.saved().records[0];
  assert.equal(record.duration, 300000); assert.equal(record.endedAt, resumed + 180000);
  assert.equal(record.segments.reduce((sum, s) => sum + s.end - s.start, 0), 300000);
});

test('an action at the deadline finalizes before pause or manual finish can duplicate it', () => {
  const app = boot(); app.click('mode-pomodoro'); app.submitMinutes(5); app.click('toggle');
  app.advance(300000, false); app.click('toggle'); app.click('finish');
  assert.equal(app.saved().records.length, 1); assert.equal(app.saved().records[0].duration, 300000);
});

test('deadline timeout completes without an interval tick and the countdown rounds up', () => {
  const app = boot(); app.click('mode-pomodoro'); app.submitMinutes(5); app.click('toggle');
  app.advance(1); assert.equal(app.nodes.timer.textContent, '00:05:00');
  app.advance(299998, false); app.flushTimeouts(); assert.equal(app.saved().records.length, 0);
  app.advance(1, false); app.flushTimeouts();
  assert.equal(app.saved().records.length, 1); assert.equal(app.saved().records[0].duration, 300000);
  app.tick(); app.flushTimeouts(); assert.equal(app.saved().records.length, 1);
});

test('reload recovers an expired pomodoro using its original exact deadline', () => {
  const at = initialTime;
  const app = boot({records: [], elapsed: 120000, firstStartedAt: at - 3600000, startedAt: at - 1800000, segments: [{start: at - 3600000, end: at - 3480000}], mode: 'pomodoro', pomodoroMinutes: 25, subject: 'math'}, at);
  const record = app.saved().records[0];
  assert.equal(record.duration, 1500000); assert.equal(record.endedAt, at - 420000);
  assert.equal(record.segments.reduce((sum, s) => sum + s.end - s.start, 0), 1500000);
  app.tick(); assert.equal(app.saved().records.length, 1);
});

test('midnight totals allocate only active segments to their calendar day', () => {
  const began = new Date(2026, 9, 16, 23, 59).getTime(), app = boot(null, began);
  app.click('toggle'); app.advance(120000); app.click('toggle');
  assert.equal(app.nodes['today-total'].dataset.value, '1');
  app.advance(120000); app.click('toggle'); app.advance(60000); app.click('finish');
  assert.equal(app.nodes['today-total'].dataset.value, '2');
  assert.equal(app.saved().records[0].duration, 180000);
  assert.equal(app.nodes['today-count'].dataset.value, '1');
});

test('navigation and native settings dialog work, reject invalid duration, and lock active settings', () => {
  const app = boot(); app.click('nav-records');
  assert.equal(app.nodes['focus-view'].hidden, true); assert.equal(app.nodes['records-view'].hidden, false);
  app.click('nav-focus'); assert.equal(app.nodes['focus-view'].hidden, false);
  app.click('settings-button'); assert.equal(app.nodes['settings-dialog'].open, true);
  for (const value of [4, 121, 5.5]) {app.submitMinutes(value); assert.equal(app.saved().pomodoroMinutes, 25);}
  app.submitMinutes(40); assert.equal(app.saved().pomodoroMinutes, 40);
  assert.equal(app.nodes['settings-dialog'].open, false);
  app.click('toggle'); assert.equal(app.nodes['pomodoro-minutes'].disabled, true);
  app.submitMinutes(60); assert.equal(app.saved().pomodoroMinutes, 40);
  app.click('settings-button'); app.click('settings-close'); assert.equal(app.nodes['settings-dialog'].open, false);
});

test('legacy records remain readable, subjects use text, and record DOM stays stable during ticks', () => {
  const subject = '<img src=x onerror=alert(1)>', record = {duration: 60000, firstStartedAt: initialTime - 60000, endedAt: initialTime, subject};
  const app = boot({records: [record], elapsed: 0, startedAt: null, firstStartedAt: null});
  assert.equal(app.nodes['today-total'].dataset.value, '1');
  const row = app.nodes.sessions.children[0], label = row.children[0].children[1].children[0];
  assert.equal(label.textContent, subject); assert.equal(label.children.length, 0);
  const replacements = app.nodes.sessions.replacements;
  app.advance(500); app.advance(500); app.click('toggle'); app.advance(1000);
  assert.equal(app.nodes.sessions.replacements, replacements);
  app.click('finish'); assert.equal(app.nodes.sessions.replacements, replacements + 1);
});

test('subsecond paused session restores as paused and keeps mode locked', () => {
  const app = boot(); app.click('toggle'); app.click('toggle');
  const restored = boot(app.saved());
  assert.equal(restored.tool('read_study_timer').status, 'paused');
  assert.equal(restored.nodes['mode-pomodoro'].disabled, true);
});

test('WebMCP controls retain existing names and validate empty input', () => {
  const app = boot(); assert.equal(app.registered.size, 4);
  assert.throws(() => app.registered.get('start_study_timer').execute({unexpected: true}), /empty object/);
  app.tool('start_study_timer'); app.advance(2000); app.tool('pause_study_timer');
  assert.equal(app.tool('read_study_timer').elapsedSeconds, 2);
  app.tool('finish_study_session'); assert.equal(app.saved().records.length, 1);
  assert.equal(app.events.filter(e => e.type === 'study:state').at(-1).detail.status, 'idle');
});

test('storage updates adopt another page state and change the 3D companion state', () => {
  const app = boot(); app.storage({records: [], elapsed: 1000, startedAt: null, firstStartedAt: initialTime - 1000, segments: [{start: initialTime - 1000, end: initialTime}], mode: 'stopwatch', subject: 'math'});
  assert.equal(app.tool('read_study_timer').status, 'paused');
  assert.equal(app.nodes['subject-select'].value, 'math');
  assert.equal(app.events.at(-1).detail.status, 'paused');
});

const localKey = ms => {const date = new Date(ms); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;};
const recordAt = (start, end, extra = {}) => ({duration: end - start, firstStartedAt: start, endedAt: end, segments: [{start, end}], ...extra});
const calendarDay = (app, day) => app.nodes['calendar-grid'].children.find(button => button.dataset.date === day);
function addSubject(app, name) {app.nodes['subject-select'].value = '__add_subject__'; app.nodes['subject-select'].emit('change'); app.nodes['subject-name'].value = name; app.nodes['subject-form'].emit('submit');}

test('daily ledger migrates segment and legacy records once and ignores malformed dates', () => {
  const start = new Date(2026, 9, 15, 23, 59, 30).getTime(), end = start + 60000;
  const old = {duration: 500, firstStartedAt: initialTime - 500, endedAt: initialTime};
  const app = boot({records: [recordAt(start, end), old], elapsed: 0, dailyTotals: {'bad': 5, '2026-02-30': 20, '2026-10-15': 1000}});
  assert.equal(app.saved().dailyTotals['2026-10-15'], 30000); assert.equal(app.saved().dailyTotals['2026-10-16'], 30500);
  assert.equal(app.saved().dailyTotalsVersion, 1); assert.equal(app.saved().dailyTotals.bad, undefined);
  const restored = boot(app.saved()); assert.deepEqual(restored.saved().dailyTotals, app.saved().dailyTotals);
  const marked = boot({...app.saved(), dailyTotals: {'2026-10-16': 12000, bad: 20}});
  assert.deepEqual(marked.saved().dailyTotals, {'2026-10-16': 12000});
  const empty = boot({...app.saved(), dailyTotals: {}}); assert.deepEqual(empty.saved().dailyTotals, {});
});

test('daily ledger retains duration after the 200-record cap and after reload', () => {
  const recent = new Date(2026, 9, 15, 12).getTime(), old = new Date(2026, 9, 1, 12).getTime();
  const records = Array.from({length: 199}, () => recordAt(recent, recent + 1000)); records.push(recordAt(old, old + 60000));
  const app = boot({records, elapsed: 0}); app.click('toggle'); app.advance(2000); app.click('finish');
  assert.equal(app.saved().records.length, 200); assert.equal(app.saved().records.some(record => record.endedAt === old + 60000), false);
  assert.equal(app.saved().dailyTotals['2026-10-01'], 60000);
  const restored = boot(app.saved()); restored.click('calendar-button');
  calendarDay(restored, '2026-10-01').emit('click'); assert.equal(restored.nodes['calendar-day-total'].textContent, '1 分钟 0 秒');
  assert.equal(restored.saved().dailyTotals['2026-10-16'], 2000);
});

test('calendar adds running and paused midnight segments without committing them early', () => {
  const start = new Date(2026, 9, 15, 23, 59, 30).getTime(), app = boot(null, start);
  app.click('toggle'); app.advance(60000); app.click('calendar-button');
  assert.equal(app.nodes['calendar-day-total'].textContent, '30 秒'); assert.deepEqual(app.saved().dailyTotals, {});
  calendarDay(app, '2026-10-15').emit('click'); assert.equal(app.nodes['calendar-day-total'].textContent, '30 秒');
  app.click('toggle'); app.advance(60000); assert.equal(app.nodes['calendar-day-total'].textContent, '30 秒');
  app.click('toggle'); app.advance(30000); calendarDay(app, '2026-10-16').emit('click');
  assert.equal(app.nodes['calendar-day-total'].textContent, '1 分钟 0 秒');
  assert.match(app.nodes['calendar-day-note'].textContent, /尚未结束/);
  app.click('finish'); assert.equal(app.saved().dailyTotals['2026-10-15'], 30000); assert.equal(app.saved().dailyTotals['2026-10-16'], 60000);
  assert.match(app.nodes['calendar-day-note'].textContent, /已完成/);
  assert.equal(app.nodes['calendar-month-total'].textContent, '1 分钟 30 秒');
});

test('legacy paused elapsed without segments is visible on its last known session date', () => {
  const first = new Date(2026, 9, 15, 22).getTime(), app = boot({records: [], elapsed: 42000, firstStartedAt: first, startedAt: null});
  app.click('calendar-button'); calendarDay(app, '2026-10-15').emit('click');
  assert.equal(app.nodes['calendar-day-total'].textContent, '42 秒');
  assert.deepEqual(app.saved().dailyTotals, {});
});

test('local-midnight splitting respects Melbourne daylight saving rather than 24-hour days', () => {
  const start = new Date(2026, 9, 3, 23, 30).getTime(), end = new Date(2026, 9, 5, 0, 30).getTime();
  const app = boot({records: [recordAt(start, end)], elapsed: 0});
  assert.equal(app.saved().dailyTotals['2026-10-03'], 1800000);
  assert.equal(app.saved().dailyTotals['2026-10-04'], 23 * 3600000);
  assert.equal(app.saved().dailyTotals['2026-10-05'], 1800000);
});

test('month navigation handles leap years, Monday-first layout, selection and today reset', () => {
  const now = new Date(2028, 0, 31, 12).getTime(), app = boot(null, now); app.click('calendar-button');
  app.click('calendar-next'); assert.match(app.nodes['calendar-month'].textContent, /2028年2月/);
  assert.match(app.nodes['calendar-selected-date'].textContent, /2月29日/);
  assert.equal(app.nodes['calendar-grid'].children.length, 42); assert.equal(app.nodes['calendar-grid'].children[0].dataset.date, '2028-01-31');
  assert.ok(calendarDay(app, '2028-02-29')); app.click('calendar-next'); assert.match(app.nodes['calendar-selected-date'].textContent, /3月29日/);
  app.click('calendar-prev'); assert.match(app.nodes['calendar-selected-date'].textContent, /2月29日/);
  app.click('calendar-today'); const today = calendarDay(app, '2028-01-31');
  assert.equal(today.getAttribute('aria-pressed'), 'true'); assert.ok(today.classes.has('is-today')); assert.ok(today.classes.has('is-selected'));
  assert.match(today.getAttribute('aria-label'), /2028年1月31日/);
  app.click('calendar-close'); assert.equal(app.nodes['calendar-dialog'].open, false);
});

test('calendar ticks preserve focused day buttons and display exact subminute duration', () => {
  const app = boot(); app.click('toggle'); app.advance(1500); app.click('calendar-button');
  const day = calendarDay(app, localKey(app.now)), rebuilds = app.nodes['calendar-grid'].replacements; day.focus();
  assert.equal(app.nodes['calendar-day-total'].textContent, '1 秒'); assert.ok(day.classes.has('has-study'));
  app.advance(1000); assert.equal(app.nodes['calendar-day-total'].textContent, '2 秒');
  assert.equal(app.nodes['calendar-grid'].replacements, rebuilds); assert.equal(app.document.activeElement, day);
  assert.equal(calendarDay(app, localKey(app.now)), day);
});

test('pomodoro ledger stops at exact deadline, including day allocation after a background delay', () => {
  const start = new Date(2026, 9, 15, 23, 58).getTime(), app = boot(null, start);
  app.click('mode-pomodoro'); app.submitMinutes(5); app.click('toggle'); app.advance(20 * 60000);
  assert.equal(app.saved().dailyTotals['2026-10-15'], 120000); assert.equal(app.saved().dailyTotals['2026-10-16'], 180000);
  app.tick(); app.click('finish'); const restored = boot(app.saved());
  assert.equal(restored.saved().dailyTotals['2026-10-16'], 180000);
});

test('record allocation uses one shared duration budget across all days', () => {
  const first = new Date(2026, 9, 14, 12).getTime(), second = new Date(2026, 9, 15, 12).getTime();
  const record = {duration: 60000, firstStartedAt: first, endedAt: second + 60000, segments: [{start: first, end: first + 60000}, {start: second, end: second + 60000}]};
  const app = boot({records: [record], elapsed: 0});
  assert.equal(Object.values(app.saved().dailyTotals).reduce((a, b) => a + b, 0), 60000);
});

test('custom subject creation trims whitespace and persists across reload before selecting it', () => {
  const app = boot(); addSubject(app, '  Project   Planning  ');
  assert.deepEqual(app.saved().customSubjects, ['Project Planning']); assert.equal(app.saved().subject, 'Project Planning');
  assert.equal(app.nodes['subject-dialog'].open, false);
  const restored = boot(app.saved()); assert.equal(restored.nodes['subject-select'].value, 'Project Planning');
  assert.ok(restored.nodes['subject-select'].options.some(option => option.value === 'Project Planning'));
  assert.equal(restored.nodes['subject-select'].options.at(-1).value, '__add_subject__');
  const unknown = boot({records: [], elapsed: 0, subject: '化学'}); assert.equal(unknown.saved().subject, '化学'); assert.ok(unknown.saved().customSubjects.includes('化学'));
});

test('custom subjects deduplicate against defaults and normalized casefolded custom names', () => {
  const app = boot(); addSubject(app, ' 数学 '); assert.equal(app.saved().subject, 'math'); assert.deepEqual(app.saved().customSubjects, []);
  addSubject(app, 'Project Planning'); addSubject(app, 'ＰＲＯＪＥＣＴ planning');
  assert.deepEqual(app.saved().customSubjects, ['Project Planning']); assert.equal(app.saved().subject, 'Project Planning');
  assert.match(app.nodes.toast.textContent, /已有科目/);
});

test('recovered legacy subject options survive switching away and subsequent additions', () => {
  const legacy = 'A'.repeat(40), app = boot({records: [], elapsed: 0, subject: legacy});
  app.nodes['subject-select'].value = 'math'; app.nodes['subject-select'].emit('change');
  const restored = boot(app.saved()); assert.ok(restored.nodes['subject-select'].options.some(option => option.value === legacy));
  addSubject(restored, '新科目'); assert.ok(restored.nodes['subject-select'].options.some(option => option.value === legacy));
  assert.ok(restored.saved().customSubjects.includes(legacy));
});

test('empty, reserved and overlong subjects are rejected; cancel restores the existing choice', () => {
  const app = boot(); const before = app.saved().subject;
  for (const name of ['   ', '__ADD_SUBJECT__', '字'.repeat(31)]) {
    addSubject(app, name); assert.equal(app.nodes['subject-dialog'].open, true); assert.equal(app.saved().subject, before);
    assert.ok(app.nodes['subject-error'].textContent); app.click('subject-cancel'); assert.equal(app.nodes['subject-select'].value, before);
  }
  addSubject(app, '   '); app.nodes['subject-dialog'].emit('cancel'); assert.equal(app.nodes['subject-select'].value, before); assert.equal(app.nodes['subject-dialog'].open, false);
  addSubject(app, '   '); app.click('subject-close'); assert.equal(app.nodes['subject-select'].value, before);
  assert.deepEqual(app.saved().customSubjects, []);
  addSubject(app, '🌱'.repeat(30)); assert.equal(Array.from(app.saved().subject).length, 30);
});

test('custom subjects treat HTML as plain text and block mutation during active study', () => {
  const app = boot(), name = '<img src=x onerror=alert(1)>'; addSubject(app, name);
  const option = app.nodes['subject-select'].options.find(option => option.value === name);
  assert.equal(option.textContent, name); assert.equal(option.children.length, 0);
  app.click('toggle'); assert.equal(app.nodes['subject-name'].disabled, true);
  app.nodes['subject-select'].value = '__add_subject__'; app.nodes['subject-select'].emit('change');
  assert.equal(app.nodes['subject-dialog'].open, false); assert.equal(app.nodes['subject-select'].value, name);
  app.nodes['subject-name'].value = 'Forbidden'; app.nodes['subject-form'].emit('submit');
  assert.deepEqual(app.saved().customSubjects, [name]);
  app.advance(2000); app.click('finish'); assert.equal(app.saved().records[0].subject, name);
});

const statRow = (app, id) => app.nodes['subject-stats-list'].children.find(row => row.dataset.subjectId === id);
const statName = row => row.children[0].children[0];
const statStatus = row => row.children[0].children[1];
const statDuration = row => row.children[1].textContent;
const subjectAmount = (app, id, date) => app.saved().subjectDailyTotals[id]?.days[date] || 0;
const subjectSum = (app, id) => Object.values(app.saved().subjectDailyTotals[id]?.days || {}).reduce((sum, value) => sum + value, 0);
const chooseSubject = (app, value) => {app.nodes['subject-select'].value = value; app.nodes['subject-select'].emit('change');};
function manageButton(app, id, archived = false) {return app.nodes[archived ? 'subjects-archived-list' : 'subjects-active-list'].children.find(row => row.dataset.subjectId === id)?.children[1];}
function openManager(app) {app.click('manage-subjects-button');}

test('subject stats include active zero-duration catalog entries and update both tab states', () => {
  const app = boot();
  assert.equal(app.nodes['subject-stats-total'].textContent, '0 秒'); assert.equal(app.nodes['subject-stats-count'].textContent, '3');
  for (const id of ['subject:self-study', 'subject:math', 'subject:其他']) assert.equal(statDuration(statRow(app, id)), '0 秒');
  app.click('subject-stats-today'); assert.equal(app.nodes['subject-stats-today'].getAttribute('aria-selected'), 'true'); assert.equal(app.nodes['subject-stats-all'].getAttribute('aria-pressed'), 'false');
  app.click('subject-stats-all'); assert.equal(app.nodes['subject-stats-all'].getAttribute('aria-selected'), 'true');
});

test('subject migration counts all legacy records before the cap and never reseeds on reload', () => {
  const records = Array.from({length: 201}, () => recordAt(initialTime - 1000, initialTime, {subject: '数学'}));
  const app = boot({records, elapsed: 0});
  assert.equal(app.saved().records.length, 200); assert.equal(subjectSum(app, 'subject:math'), 201000); assert.equal(app.saved().subjectDailyTotalsVersion, 1);
  const restored = boot(app.saved()); assert.equal(subjectSum(restored, 'subject:math'), 201000);
  chooseSubject(restored, 'math'); restored.click('toggle'); restored.advance(2000); restored.click('finish');
  assert.equal(subjectSum(restored, 'subject:math'), 203000); assert.equal(restored.saved().records[0].subjectId, 'subject:math');
  assert.equal(boot(restored.saved()).saved().subjectDailyTotals['subject:math'].days['2026-10-16'], 203000);
});

test('unknown evicted history reconciles into unclassified without invented subject attribution', () => {
  const record = recordAt(initialTime - 60000, initialTime, {subject: '数学'});
  const app = boot({records: [record], elapsed: 0, dailyTotalsVersion: 1, dailyTotals: {'2026-10-15': 120000, '2026-10-16': 180000}});
  assert.equal(subjectAmount(app, 'subject:math', '2026-10-16'), 60000);
  assert.equal(subjectAmount(app, 'unclassified', '2026-10-16'), 120000); assert.equal(subjectAmount(app, 'unclassified', '2026-10-15'), 120000);
  assert.equal(app.nodes['subject-stats-total'].textContent, '5 分钟 0 秒');
  assert.equal(statRow(app, 'subject:math').children[3].textContent, '20%'); assert.equal(statRow(app, 'unclassified').children[2].children[0].style.width, '80%');
  app.click('subject-stats-today'); assert.equal(app.nodes['subject-stats-total'].textContent, '3 分钟 0 秒');
  assert.deepEqual(boot(app.saved()).saved().subjectDailyTotals, app.saved().subjectDailyTotals);
});

test('versioned subject ledger preserves existing amounts and adds each reconciliation gap once', () => {
  const app = boot({records: [recordAt(initialTime - 60000, initialTime, {subject: '数学'})], elapsed: 0, dailyTotalsVersion: 1, dailyTotals: {'2026-10-16': 180000}, subjectDailyTotalsVersion: 1, subjectDailyTotals: {'subject:math': {label: '数学', days: {'2026-10-16': 60000}}}});
  assert.equal(subjectSum(app, 'subject:math'), 60000); assert.equal(subjectSum(app, 'unclassified'), 120000);
  const again = boot(app.saved()); assert.equal(subjectSum(again, 'subject:math'), 60000); assert.equal(subjectSum(again, 'unclassified'), 120000);
});

test('default actual-value and display-label aliases share one authoritative stable category', () => {
  const records = [recordAt(initialTime - 30000, initialTime, {subject: '其他'}), recordAt(initialTime - 40000, initialTime, {subject: '其他学习'}), recordAt(initialTime - 50000, initialTime, {subject: 'Translated display', subjectId: 'subject:其他'})];
  const app = boot({records, elapsed: 0});
  assert.equal(subjectSum(app, 'subject:其他'), 120000); assert.equal(statName(statRow(app, 'subject:其他')).textContent, '其他学习');
  chooseSubject(app, 'math'); app.nodes['subject-select'].options.find(option => option.value === 'math').textContent = 'Mathematics translated by browser';
  app.click('toggle'); app.advance(2000); app.click('finish'); assert.equal(app.saved().records[0].subject, '数学'); assert.equal(app.saved().records[0].subjectId, 'subject:math');
});

test('normalized custom duplicates merge while unrelated language names remain distinct', () => {
  const records = [recordAt(initialTime - 1000, initialTime, {subject: 'Ｐｒｏｊｅｃｔ   Planning'}), recordAt(initialTime - 2000, initialTime, {subject: 'project planning'}), recordAt(initialTime - 3000, initialTime, {subject: 'Machine Learning'}), recordAt(initialTime - 4000, initialTime, {subject: '机器学习'})];
  const app = boot({records, elapsed: 0});
  assert.equal(subjectSum(app, 'subject:project planning'), 3000);
  assert.equal(subjectSum(app, 'subject:machine learning'), 3000); assert.equal(subjectSum(app, 'subject:机器学习'), 4000);
});

test('subject today/cumulative overlay splits midnight and excludes a paused midnight gap', () => {
  const start = new Date(2026, 9, 15, 23, 59, 30).getTime(), app = boot(null, start); chooseSubject(app, 'math');
  app.click('toggle'); app.advance(20000); app.click('toggle'); app.advance(30000);
  assert.equal(statDuration(statRow(app, 'subject:math')), '20 秒'); assert.equal(subjectSum(app, 'subject:math'), 0);
  app.click('subject-stats-today'); assert.equal(statDuration(statRow(app, 'subject:math')), '0 秒');
  app.click('toggle'); app.advance(30000); assert.equal(statDuration(statRow(app, 'subject:math')), '30 秒');
  app.click('finish'); assert.equal(subjectAmount(app, 'subject:math', '2026-10-15'), 20000); assert.equal(subjectAmount(app, 'subject:math', '2026-10-16'), 30000);
  assert.equal(statDuration(statRow(app, 'subject:math')), '30 秒'); app.click('subject-stats-all'); assert.equal(statDuration(statRow(app, 'subject:math')), '50 秒');
});

test('classified day ledgers preserve both 23-hour and 25-hour Melbourne DST days', () => {
  const springStart = new Date(2026, 9, 3, 23, 30).getTime(), springEnd = new Date(2026, 9, 5, 0, 30).getTime();
  const fallStart = new Date(2026, 3, 4, 23, 30).getTime(), fallEnd = new Date(2026, 3, 6, 0, 30).getTime();
  const app = boot({records: [recordAt(springStart, springEnd, {subject: '数学'}), recordAt(fallStart, fallEnd, {subject: '数学'})], elapsed: 0});
  assert.equal(subjectAmount(app, 'subject:math', '2026-10-04'), 23 * 3600000); assert.equal(subjectAmount(app, 'subject:math', '2026-04-05'), 25 * 3600000);
});

test('subject Pomodoro ledger clips a resumed cross-midnight run to its exact deadline', () => {
  const start = new Date(2026, 9, 15, 23, 50).getTime(), app = boot(null, start); chooseSubject(app, 'math'); app.click('mode-pomodoro'); app.submitMinutes(5);
  app.click('toggle'); app.advance(240000); app.click('toggle'); app.advance(340000); app.click('toggle'); app.advance(200000);
  assert.equal(subjectAmount(app, 'subject:math', '2026-10-15'), 260000); assert.equal(subjectAmount(app, 'subject:math', '2026-10-16'), 40000);
  app.click('subject-stats-today'); assert.equal(statDuration(statRow(app, 'subject:math')), '40 秒'); assert.equal(app.saved().records.length, 1);
});

test('subject stat rows stay stable during ticks, pause and completion without double-counting overlay', () => {
  const app = boot(); chooseSubject(app, 'math'); const row = statRow(app, 'subject:math'), rebuilds = app.nodes['subject-stats-list'].replacements;
  app.click('toggle'); app.advance(1500); assert.equal(statDuration(row), '1 秒'); assert.equal(statStatus(row).textContent, '本次学习中');
  app.click('toggle'); app.advance(10000); assert.equal(statDuration(row), '1 秒'); assert.equal(statStatus(row).textContent, '本次已暂停');
  app.click('finish'); assert.equal(subjectSum(app, 'subject:math'), 1500); assert.equal(statDuration(row), '1 秒'); assert.equal(statStatus(row).hidden, true);
  assert.equal(statRow(app, 'subject:math'), row); assert.equal(app.nodes['subject-stats-list'].replacements, rebuilds);
});

test('deleting selected idle default hides it, preserves history, survives reload and restores cleanly', () => {
  const app = boot(); chooseSubject(app, 'math'); app.click('toggle'); app.advance(60000); app.click('finish'); openManager(app);
  assert.equal(manageButton(app, 'subject:math').getAttribute('aria-label'), '删除科目 数学'); manageButton(app, 'subject:math').emit('click');
  assert.equal(app.saved().subject, ''); assert.equal(app.nodes['subject-select'].options.some(option => option.value === 'math'), false);
  assert.equal(statStatus(statRow(app, 'subject:math')).textContent, '已删除'); assert.equal(subjectSum(app, 'subject:math'), 60000);
  const restored = boot(app.saved()); assert.equal(restored.nodes['subject-select'].options.some(option => option.value === 'math'), false); openManager(restored);
  manageButton(restored, 'subject:math', true).emit('click'); assert.equal(restored.nodes['subject-select'].options.some(option => option.value === 'math'), true);
  assert.equal(restored.saved().subject, ''); assert.equal(subjectSum(restored, 'subject:math'), 60000); assert.equal(statStatus(statRow(restored, 'subject:math')).hidden, true);
});

test('running and paused current subjects cannot be deleted while other deletions preserve the session', () => {
  const app = boot(); chooseSubject(app, 'math'); app.click('toggle'); app.advance(2000); openManager(app);
  const current = manageButton(app, 'subject:math'); assert.equal(current.disabled, true); current.emit('click');
  assert.equal(app.saved().subjectCatalog['subject:math'].deleted, false); assert.match(app.nodes['subjects-message'].textContent, /先结束/);
  app.click('toggle'); assert.equal(manageButton(app, 'subject:math').disabled, true); manageButton(app, 'subject:math').emit('click');
  manageButton(app, 'subject:其他').emit('click'); assert.equal(app.tool('read_study_timer').status, 'paused'); assert.equal(app.saved().subject, 'math'); assert.equal(app.tool('read_study_timer').elapsedSeconds, 2);
  app.click('toggle'); app.advance(1000); assert.equal(app.tool('read_study_timer').elapsedSeconds, 3);
  assert.equal(app.nodes['subjects-add-button'].disabled, true);
});

test('all defaults and custom subjects can be hidden without tombstone resurrection', () => {
  const app = boot(); addSubject(app, 'Review'); openManager(app);
  for (const id of Object.keys(app.saved().subjectCatalog)) manageButton(app, id).emit('click');
  assert.equal(app.saved().subject, ''); assert.equal(app.nodes['subjects-active-list'].children[0].className, 'subject-manage-empty');
  assert.equal(app.nodes['subject-stats-count'].textContent, '0');
  const restored = boot(app.saved()); assert.deepEqual(restored.nodes['subject-select'].options.map(option => option.value), ['', '__add_subject__']);
  openManager(restored); assert.equal(restored.nodes['subjects-archived-section'].hidden, false);
  manageButton(restored, 'subject:其他', true).emit('click'); assert.equal(restored.nodes['subject-select'].options.some(option => option.value === '其他'), true);
});

test('readding a deleted default label alias revives its actual-value bucket', () => {
  const app = boot({records: [recordAt(initialTime - 10000, initialTime, {subject: '其他学习'})], elapsed: 0}); openManager(app); manageButton(app, 'subject:其他').emit('click'); app.click('subjects-close');
  addSubject(app, ' 其他学习 '); assert.equal(app.saved().subject, '其他'); assert.equal(app.saved().subjectCatalog['subject:其他'].deleted, false);
  assert.equal(subjectSum(app, 'subject:其他'), 10000); assert.equal(app.saved().customSubjects.includes('其他学习'), false);
  assert.equal(statStatus(statRow(app, 'subject:其他')).hidden, true);
});

test('deleted legacy subject history remains classified even after every matching detail is evicted', () => {
  const recent = Array.from({length: 200}, () => recordAt(initialTime - 1000, initialTime, {subject: '数学'}));
  const old = recordAt(new Date(2026, 8, 1, 12).getTime(), new Date(2026, 8, 1, 12, 1).getTime(), {subject: 'Old Course'});
  const app = boot({records: [...recent, old], elapsed: 0}); openManager(app); manageButton(app, 'subject:old course').emit('click');
  const restored = boot(app.saved()); assert.equal(restored.saved().records.some(record => record.subject === 'Old Course'), false);
  assert.equal(subjectSum(restored, 'subject:old course'), 60000); assert.equal(statStatus(statRow(restored, 'subject:old course')).textContent, '已删除');
  assert.equal(restored.nodes['subject-select'].options.some(option => option.value === 'Old Course'), false);
});

test('readding a deleted custom casefolded alias reuses its bucket and original label', () => {
  const app = boot(); addSubject(app, 'Project Planning'); app.click('toggle'); app.advance(2000); app.click('finish'); openManager(app);
  manageButton(app, 'subject:project planning').emit('click'); app.click('subjects-close'); addSubject(app, 'ＰＲＯＪＥＣＴ planning');
  assert.equal(app.saved().subject, 'Project Planning'); assert.equal(subjectSum(app, 'subject:project planning'), 2000);
  assert.equal(app.saved().customSubjects.length, 1); assert.match(app.nodes.toast.textContent, /已恢复/);
});

test('unclassified history, custom 未分类 and __proto__ remain distinct safe categories', () => {
  const app = boot({records: [], elapsed: 0, dailyTotalsVersion: 1, dailyTotals: {'2026-10-16': 60000}});
  addSubject(app, '未分类'); app.click('toggle'); app.advance(2000); app.click('finish');
  addSubject(app, '__proto__'); app.click('toggle'); app.advance(1000); app.click('finish');
  assert.equal(subjectSum(app, 'unclassified'), 60000); assert.equal(subjectSum(app, 'subject:未分类'), 2000); assert.equal(subjectSum(app, 'subject:__proto__'), 1000);
  assert.equal(Object.prototype.polluted, undefined); assert.ok(statRow(app, 'subject:__proto__'));
});

test('subject stats and management display HTML-like names as text through delete and restore', () => {
  const app = boot(), name = '<img src=x onerror=alert(1)>'; addSubject(app, name); app.click('toggle'); app.advance(2000); app.click('finish'); openManager(app);
  const id = app.saved().records[0].subjectId, row = app.nodes['subjects-active-list'].children.find(row => row.dataset.subjectId === id);
  assert.equal(row.children[0].textContent, name); assert.equal(row.children[0].children.length, 0); assert.equal(statName(statRow(app, id)).textContent, name); assert.equal(statName(statRow(app, id)).children.length, 0);
  manageButton(app, id).emit('click'); manageButton(app, id, true).emit('click'); assert.equal(statName(statRow(app, id)).textContent, name);
});

test('manager add closes its modal before opening the existing add dialog', () => {
  const app = boot(); app.click('records-manage-subjects'); assert.equal(app.nodes['subjects-dialog'].open, true);
  app.click('subjects-add-button'); assert.equal(app.nodes['subjects-dialog'].open, false); assert.equal(app.nodes['subject-dialog'].open, true); assert.equal(app.document.activeElement, app.nodes['subject-name']);
});

test('deleted recovered 40-character subjects stay hidden on reload and restore without new-name validation', () => {
  const name = 'A'.repeat(40), app = boot({records: [], elapsed: 0, subject: name}); openManager(app); manageButton(app, `subject:${name.toLowerCase()}`).emit('click');
  const restored = boot(app.saved()); assert.equal(restored.nodes['subject-select'].options.some(option => option.value === name), false); openManager(restored);
  manageButton(restored, `subject:${name.toLowerCase()}`, true).emit('click'); assert.ok(restored.nodes['subject-select'].options.some(option => option.value === name));
});

console.log(`${passed} meaningful timer, calendar, catalog and subject-stat scenarios passed.`);
