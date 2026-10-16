# 森里学习计时项目

用户指定的固定源码目录为 `/Users/unsio/Desktop/senli-study-companion`。后续所有功能、样式、图片和测试修改均在该目录完成；不要在旧工作区重新建立开发副本。

- 保留 GitHub 仓库 `https://github.com/HongWangCheang/game.git` 及现有分支 `codex/senli-study-companion`。
- 本地运行：`python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`。
- 回归检查：`node tests/study-timer.test.cjs`（使用可用的 Node.js 运行时）。
- 页面结构在 `dist/index.html`，逻辑在 `dist/app.js`，样式在 `dist/styles.css`；保留现有动画、学习记录迁移、日历、科目统计及删除恢复行为。
- `.openai/hosting.json` 保留现有 Sites project_id 和发布配置，线上地址为 `https://senli-study-companion.ramonecheang.chatgpt.site/`。
- 旧目录 `/Users/unsio/Documents/Codex/2026-10-04/wo/work/forest-study` 是独立 Sites 源代码仓库，仅作为发布同步目录。发布前遵循 Sites 技能打开同一 Site，保留该仓库的 `.git`，将桌面目录的应用源码、测试和相关文档同步过去；使用技能的 source helper 保存和发布，勿将两个 Git 历史互相覆盖。
