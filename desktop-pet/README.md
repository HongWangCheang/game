# 森里小企鹅 · 桌面宠物

透明背景、无边框、总在所有软件最前面的小企鹅桌宠（Electron）。不需要打开网站，切到 Google、Pages 或别的软件时它都一直在屏幕上。

画面来自 `../baby_penguin.blend` 的 `Penguin_Walk` / `Penguin_Sit` 动作（Cycles 透明背景渲染，与网站 `dist/assets/pet-*.webp` 相同）。

## 它会做什么

- 在屏幕底部来回散步，走累了坐下休息一会儿，再站起来继续走；碰到屏幕边缘会掉头。
- 点一下：蹦一下并说句鼓励的话。按住拖动：放到屏幕任意位置。
- 只有点在小企鹅身上才会响应，周围透明的地方点击会直接穿透到下面的软件。
- 切换桌面（Space）或别的软件全屏时也在；不占用 Dock。
- 右键小企鹅或点菜单栏里的小企鹅图标：散步 / 坐下休息 / 陪我学习（原地走路）/ 回到右下角 / 开机时自动启动 / 退出。

## 安装（Mac）

1. 下载对应的压缩包并解压：Apple 芯片（M1–M4）用 `SenliPenguin-1.0.0-arm64-mac.zip`，Intel 芯片用 `SenliPenguin-1.0.0-x64-mac.zip`。
2. 把「Senli Penguin.app」拖进「应用程序」文件夹。
3. 这个 App 没有 Apple 开发者签名，第一次打开前在「终端」运行一次：
   ```bash
   xattr -cr "/Applications/Senli Penguin.app"
   ```
   然后双击打开（或右键 →「打开」）。

## 开发

```bash
cd desktop-pet
npm install
npm start          # 直接运行
npm run dist:mac   # 打包 Apple 芯片和 Intel 两个版本到 release/
```

- `main.js`：透明置顶窗口、点击穿透、拖动、沿屏幕底部移动、菜单栏图标和右键菜单。
- `renderer.js`：序列帧动画和行为（散步 ↔ 坐下休息、点击说话、只在不透明像素上接收鼠标）。
- 更换画面：替换 `assets/pet-walk.webp`（28 帧，7 列）和 `assets/pet-sit.webp`（60 帧，10 列），每帧 192×192。
