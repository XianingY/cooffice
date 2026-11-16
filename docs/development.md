# 开发指南

## 技术栈

React + TypeScript + Vite,浏览器端静态应用。npm 管理依赖。测试使用 Vitest、Testing Library 与 Playwright;SheetJS 处理 `.xlsx`,`docx` 生成 Word。

## 目录结构

- `src/core`:纯 TypeScript 领域逻辑(指标、影响、报告、图表、校验、配置、迁移、AI 数值护栏)。不得引用 React、DOM、SheetJS、docx 或 localStorage。
- `src/adapters`:第三方文件格式与浏览器 API 隔离层(xlsx、csv、docx、storage、ai、wps)。
- `src/state`:`useReducer` 项目状态机。
- `src/components`:只负责展示与派发用户操作,不复制核心计算。
- `tests`:core / adapters / state / ui 单元测试。
- `e2e`:Playwright 完整用户链路测试。

## 本地命令

```bash
npm ci
npm run example:generate   # 重新生成虚构模板与示例
npm run dev                # 开发服务器
npm run typecheck
npm test                   # Vitest 单元测试
npm run test:e2e           # Playwright(需 npx playwright install chromium)
npm run build              # tsc + Vite 生产构建
npm run preview            # 预览 dist/
```

提交前必须通过四道门禁:`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`。

## 代码约束

- 新行为先写失败测试,再做最小实现。
- 导出只使用已确认的 `baseline`,不含未应用草稿。
- 不为了通过测试而删除断言、放宽校验或引入服务端。
- AI provider 的密钥不得进入仓库、日志、localStorage、项目文件或错误信息。
- 数据格式变更必须提供迁移路径与迁移测试(v1→v2→v3 已有先例)。

## 数据格式演进

- `schemaVersion 1`:v0.1.0 本地快照,仅 baseline/draft/updatedAt。
- `schemaVersion 2`:v0.2.0 项目文件,增加 format 标识。
- `schemaVersion 3`:v0.3.0 起增加报告配置;v1.0.0 本地存储也统一为该版本。

`parseProjectFile` 是唯一的读取入口,负责校验与迁移,未知版本/格式被拒绝。

## 发布

- `ci` 工作流:每次 push/PR 执行安装、生成示例、类型检查、单元测试、端到端测试与构建。
- `deploy` 工作流:仅在推送 `v*.*.*` 标签或手动触发时构建并部署到 GitHub Pages。它复用同一套门禁,产物来自 `dist/`。

发布版本前更新 CHANGELOG 与 ROADMAP,并确保 tag 与 `package.json` 版本一致。
