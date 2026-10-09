# 森里 · 学习计时

一个森林伙伴陪伴的学习计时 App 原型。点击开始学习，小伙伴会醒来、轻轻挪步和吃叶子；暂停或结束学习时，它会闭眼睡觉。

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
