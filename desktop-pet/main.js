const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage } = require('electron');
const path = require('node:path');

// 森里小企鹅：透明、无边框、总在最前面的桌面宠物窗口。
const WIDTH = 200, HEIGHT = 230;
let win = null, tray = null, dragOffset = null;

function workArea() {
  return screen.getDisplayMatching(win ? win.getBounds() : { x: 0, y: 0, width: 1, height: 1 }).workArea;
}

function homePosition() {
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x + area.width - WIDTH - 40, y: area.y + area.height - HEIGHT };
}

function createWindow() {
  win = new BrowserWindow({
    width: WIDTH, height: HEIGHT, ...homePosition(),
    transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  // 浮在所有窗口之上，切换桌面（Space）或别的软件全屏时也一直在。
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 透明区域点击穿透，只有点到小企鹅身上才会响应。
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('index.html');
}

function showMenu() {
  return Menu.buildFromTemplate([
    { label: '散步', click: () => win.webContents.send('pet:mode', 'wander') },
    { label: '坐下休息', click: () => win.webContents.send('pet:mode', 'sit') },
    { label: '陪我学习（原地走路）', click: () => win.webContents.send('pet:mode', 'study') },
    { type: 'separator' },
    { label: '回到右下角', click: () => { const p = homePosition(); win.setPosition(p.x, p.y); } },
    { label: '开机时自动启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: '退出小企鹅', role: 'quit' },
  ]);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createWindow();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayIcon.png'));
  tray = new Tray(icon);
  tray.setToolTip('森里小企鹅');
  tray.on('click', () => tray.popUpContextMenu(showMenu()));
  tray.on('right-click', () => tray.popUpContextMenu(showMenu()));
});
app.on('window-all-closed', () => app.quit());

ipcMain.on('pet:ignore-mouse', (_event, ignore) => win?.setIgnoreMouseEvents(ignore, { forward: true }));
ipcMain.on('pet:menu', () => showMenu().popup({ window: win }));

// 散步：按水平速度移动窗口，碰到屏幕边缘时告诉页面掉头。
ipcMain.handle('pet:walk', (_event, dx) => {
  if (!win) return 0;
  const area = workArea(), [x, y] = win.getPosition();
  const nx = Math.round(x + dx), min = area.x, max = area.x + area.width - WIDTH;
  const groundY = area.y + area.height - HEIGHT;
  const clamped = Math.min(Math.max(nx, min), max);
  win.setPosition(clamped, Math.min(y, groundY));
  return clamped === min ? -1 : clamped === max ? 1 : 0;
});

// 拖动：记住按下时鼠标与窗口左上角的偏移。
ipcMain.on('pet:drag-start', () => {
  const cursor = screen.getCursorScreenPoint(), [x, y] = win.getPosition();
  dragOffset = { dx: cursor.x - x, dy: cursor.y - y };
});
ipcMain.on('pet:drag-move', () => {
  if (!dragOffset) return;
  const cursor = screen.getCursorScreenPoint();
  win.setPosition(cursor.x - dragOffset.dx, cursor.y - dragOffset.dy);
});
ipcMain.on('pet:drag-end', () => { dragOffset = null; });
