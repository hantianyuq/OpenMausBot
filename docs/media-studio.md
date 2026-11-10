# 稿台首版

这是当前 Fork 中的内容工作台，复用 OpenMausBot 服务、工作区数据目录、认证路由和原子文件写入。入口为 `/media.html`，不需要模型密钥即可启动。

```sh
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm --filter openmausbot install --frozen-lockfile --ignore-scripts
pnpm exec vite build
pnpm start:media
```

默认打开 http://127.0.0.1:8810/media.html 。仅供本机使用，数据持久化在仓库 `.media-studio/data`，不会使用原有 `~/.openmausbot`。可通过 `OMB_PORT` 和 `OMB_MEDIA_DATA_DIR` 修改端口与数据位置。停止进程后再次启动，项目仍在。

调研材料 → 整理三平台草稿 → 编辑与预览 → 保存 → 导出内容包。整理采用明确的规则转换，不调用实时模型。覆盖草稿前需在界面确认；人工编辑不会在切换平台时被覆盖。保存保留最近 30 个历史版本，并拒绝过期窗口覆盖新版本。

导出 ZIP 包含：小红书 1080×1440 PNG 图卡和正文；X thread.txt / thread.json；公众号带内联样式的 article.html 和 Markdown；完整 project.json 与来源、核查范围。公众号可复制富文本，粘贴后仍需在平台编辑器检查样式。X 显示的是 Unicode 字符数，不是平台加权计数；首版不执行平台发布。

自带 OpenMausBot 材料固定在 f9c25dd / v0.1.151，只声明源码调研结果。图卡文字独立于笔记正文，可逐张编辑。内容较长时导出会调整字号，无法容纳则拒绝导出。

模型接入、事实检索、平台账号连接与实际发布尚未完成。当前版本的生成能力是材料整理，不应称为 AI 实时生成。

本机最小发布年龄策略拒绝上游 CUA 0.45.4，因此将桌面 SDK 固定为满足策略的 0.44.0，锁文件完整性取自 npm registry。此首版只验证 Web / headless 路径；未验证降版后的 Electron 电脑控制功能。

验证：

```sh
node --experimental-strip-types --test server/media-studio/store.node-test.ts
pnpm exec tsc -b
pnpm exec tsc -p tsconfig.server.json
```

HTTP 和浏览器验收必须使用 `scripts/control-omb.ts launch` 产生的隔离工作区，不对个人内容库测试写入。浏览器验收使用本机 Playwright（当前未提供 Browser 插件）。

```sh
OMB_UI_PLAYWRIGHT_CORE=/path/to/playwright-core \
OMB_UI_CHROMIUM=/path/to/chrome \
node --experimental-strip-types scripts/verify-media-studio.mjs
```

此脚本自动创建和销毁 OpenMausBot 隔离 fixture，覆盖材料整理、跨平台保留人工编辑、持久化、历史恢复、下载、过期版本拒绝、来源校验和跨站写入拒绝。证据保存在本机 `.media-studio/evidence`，不会提交账号数据。

2026-11-10 验收：两个 Node 测试、前后端 TypeScript 检查、变更文件 oxlint、Vite 构建均通过。真实 Chromium 浏览器完成上述流程，控制台无错误；ZIP 解压 CRC 校验通过，4 张 PNG 均为 1080×1440，X 有 5 条帖子，公众号导出保留了人工修改的摘要。构建仍有上游 CSS highlight、第三方注释与大分块提示。

视觉核对使用 Image Gen 概念图和浏览器截图逐张查看，桌面视口 1536×1024、手机视口 390×844。核对点包括左右分栏、白底与橙色强调、中文标题和编辑器字号、图卡 3:4 比例、平台标签与按钮文案、手机纵向排列；未发现裁切或横向溢出。为完成必需功能，在概念图基础上增加保存、项目列表、历史记录、图卡翻页与模型状态说明，左栏“素材库”调整为“调研材料”。首屏文案差异均来自这些功能或已核查材料。概念图在 Codex 图像产物中，最终截图在上述 evidence 目录；截图由 Playwright 获取，均已通过图像查看工具检查。
