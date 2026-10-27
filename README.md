# 森里 · 学习计时

一个森林伙伴陪伴的学习计时 App 原型。点击开始学习，小伙伴会醒来、轻轻挪步和吃叶子；暂停或结束学习时，它会闭眼睡觉。

## 固定工作目录

项目已移到桌面：`/Users/unsio/Desktop/senli-study-companion`。
后续源码修改统一在这个文件夹中进行。页面入口为 `dist/index.html`，计时和科目统计逻辑为 `dist/app.js`，界面样式为 `dist/styles.css`。

GitHub 仓库：<https://github.com/HongWangCheang/game>，后续统一使用 `main` 分支。
原工作区中的 `work/forest-study` 只作为现有 Sites 网站的发布同步目录；需要发布时从桌面工作目录同步，不单独在旧目录开发。

## 本地运行

这是静态 HTML、CSS 和 JavaScript 项目，无需安装 npm 依赖或构建。

在仓库目录执行：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

然后打开 <http://127.0.0.1:4173/>。使用本地 HTTP 服务加载 JavaScript 模块。

## 已实现

- 开始、暂停、继续和结束学习计时。
- 本次时长、今日累计和学习记录；数据保存在当前浏览器的 localStorage。
- 使用原始插画纹理，沿角色轮廓增加起伏和立体厚度，保留原图的脸型、毛色和身体比例。
- 学习时轻微散步和吃叶子动作，暂停时闭眼、呼吸起伏；支持小角度拖动查看立体细节。
- 手机和桌面布局，以及减少动态效果偏好。
- WebGL 不可用时显示原图作为备用画面。

角色采用原画纹理加立体厚度的方式，优先还原正面外观；侧面和背面不是完整重新建模的角色。

## 文件

- `dist/index.html`：页面入口。
- `dist/app.js`：计时、学习记录和浏览器本地保存。
- `dist/companion-model.js`：角色表面、厚度和动画。
- `dist/companion-scene.js`：Three.js 场景、贴图和计时状态联动。
- `dist/assets/`：原图、睡觉状态贴图和森林背景。
- `dist/vendor/`：项目使用的 Three.js 文件和 MIT 许可证。
- `.openai/hosting.json`：现有 Sites 部署配置。

当前在线原型：[森里学习计时](https://senli-study-companion.ramonecheang.chatgpt.site/)。访问权限沿用现有 Sites 设置。

本次导入的 App 源码来自已发布版本的 Git 提交 `e41e4b33cf8d04da4994bac17e7c117448efcd80`。

Three.js 使用 MIT 许可证，见 `dist/vendor/THREE-LICENSE.txt`。角色图片不包含在 Three.js 的许可证中。

## 暖金森林页面更新

页面参考新的森林界面进行了重绘：暖金色森林背景、奶油色卡片、细金边框和植物装饰，支持手机布局。

新增可用控件：

- 顶部「专注空间 / 学习记录」切换。
- 「正计时 / 番茄钟」切换；番茄钟默认 25 分钟，到点自动保存本次专注。
- 学习科目选择，并在完成的学习记录中显示科目。
- 计时设置，可将番茄钟调整为 5–120 分钟。

开始本次学习后会锁定模式、科目和时长，避免中途修改影响累计时间；暂停、继续和结束本次仍可操作。已有浏览器学习记录会保留。

## 学习日历与自定义科目

- 顶部的日历按钮可打开月历，切换月份或选择日期，查看每天和本月累计学习时长。
- 日历包含本次已计时的时间，暂停不累计；跨午夜的学习会按本地日期分开统计。
- 每日累计会独立保留，不受详细学习记录列表最多 200 条的限制。已有记录会自动纳入统计。
- 科目列表最后的「+ 添加学习科目…」可填写自己的名称（最多 30 个字符）。名称和选择刷新后保留，同名科目会直接选中已有项。
- 本次学习结束后可更换或添加科目。科目和学习数据保存在当前浏览器。

可选的回归检查使用 Node.js 内置模块，无需安装测试依赖：

```sh
node tests/study-timer.test.cjs
```

## 按科目统计与科目管理

「学习记录」页面新增「科目统计」，可切换「全部累计」和「今日」，查看各科目的学习时长与占比；本次已累计的学习时间也会计入。

在计时器的科目选择框旁点击「管理」，或在学习记录中点击「管理科目」，即可添加、删除和恢复科目。删除只会把科目移出选择列表，已有学习记录和累计时长会保留；正在学习或已暂停的当前科目，需要结束本次学习后再删除。

科目累计独立保存，不会随详细记录超过 200 条而丢失。早期无法归属到具体科目的时长归入「未分类」。

## 季节切换

伙伴画面右上角的季节按钮（原「吃叶子」状态标签的位置）可在春、夏、秋、冬之间循环切换，选择会保存在当前浏览器（`senli-season`）。

- 春、夏、秋只改变森林背景的色调，袋熊本身保持原色；切换时颜色平滑过渡。原图为夏天。
- 冬天：整个网页背景换成 `dist/assets/winter-forest.jpeg` 雪景图，并有全屏飘雪（`dist/winter.js`）。陪伴框里显示 Blender 模型 `baby_penguin.blend` 的完整场景动画（用模型自带相机和 Cycles 渲染的 `Penguin_Walk`，28 帧，`dist/assets/penguin-walk.webm` / `.mp4`）：开始学习后先站起来再循环走路（`penguin-stand-up` → `penguin-walk`）；暂停或未开始时坐下休息（`penguin-sit-down` → 循环 `penguin-sit-idle`），坐下动作来自 Blender 里的 `Penguin_Sit`。
- 文件：`dist/season-switch.js`（按钮与保存），`dist/companion-scene.js`（背景着色器调色）。
- 袋熊当前动作（散步中 / 吃叶子 / 休息中）仍保留给读屏器。
- 果冻海场景已移除；Blender 源文件 `sea.blend` 保留在仓库中。

## 桌宠小企鹅

网页里不显示桌宠。点「开始学习」的那一下，小企鹅会弹进一个总在所有软件最前面的小窗口（`dist/desk-pet.js`，Document Picture-in-Picture，Chrome / Edge 116+）；切到别的网页或软件（例如 Pages）时它一直在旁边陪着你。

- 学习时走路，暂停时坐下休息，重置或结束本次学习后小窗口自动关闭。
- 小窗口可以拖到屏幕任意位置；点小企鹅会蹦一下并说句鼓励的话；悬停出现「×」可收起。
- 陪伴框右上角的 🐧 按钮可随时打开或收起桌宠（不支持的浏览器不显示）。
- 如果电脑上开着 Mac 桌宠 App（`desktop-pet/`），学习状态会同步给 App 里的小企鹅，网页不再弹出小窗口。
- 画面是 `baby_penguin.blend` 的 `Penguin_Walk` / `Penguin_Sit` 透明背景渲染序列帧：`dist/assets/pet-walk.webp`（28 帧，7 列）、`dist/assets/pet-sit.webp`（60 帧，10 列），每帧 192×192。

## 桌面宠物 App

`desktop-pet/` 是独立的 Mac 桌宠小程序（Electron）：透明背景、总在最前面，不需要打开网站。安装和开发说明见 `desktop-pet/README.md`。

## 网站名称与公开地址

网站名为「萌宠监管」，通过 GitHub Pages 公开发布：**https://hongwangcheang.github.io/game/**

- `.github/workflows/pages.yml`：每次推送到 `main`（`dist/` 有改动时）先跑回归测试，再把 `dist/` 发布到 GitHub Pages。
- 首次启用：仓库管理员在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，然后在 **Actions** 里重新运行一次「Deploy site to GitHub Pages」。
- 本地存储键名（`senli-*`）保持不变，改名不影响已有的学习记录。
