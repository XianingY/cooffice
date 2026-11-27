# 贡献指南

感谢你愿意改进 What-if Report！项目优先保证**确定性、可验证性、清晰边界和小步交付**。

## 开始前

1. 阅读 [README](README.md)（或 [English README](README.en.md)）、[开发指南](docs/development.md) 和 [路线图](ROADMAP.md)。
2. 对较大改动先创建 Issue，说明用户问题、建议范围和验收标准。
3. **切勿**在 Issue、PR、测试数据或截图中提交真实业务文件、个人信息、密钥或内部地址（CI 含全历史 gitleaks 扫描）。

## 本地环境（一键初始化）

需要 Node.js 22+ 与 npm：

```bash
# 仅开发前端（零配置、最快）
npm run setup -- --web
npm run dev

# 前后端全栈（自动复制 server/.env 并执行 SQLite 迁移）
npm run setup -- --full
npm run dev:full

# 全量（前端 + 后端 + Electron 桌面端）
npm run setup
```

也可以直接使用 GitHub Codespaces（仓库已内置 `.devcontainer/devcontainer.json`）。

首次运行浏览器 / 桌面端 E2E 测试前执行：

```bash
npx playwright install --with-deps chromium
```

修改示例数据或模板时，运行 `npm run example:generate` 重新生成 `public/templates` 下的虚构文件。

## 提交前验证

```bash
npm run verify            # lint + typecheck + 根 Vitest + 浏览器 E2E + 前后端构建与后端测试
npm run test:e2e:full     # 改动前后端接口契约时运行（真实 Fastify + SQLite）
npm run desktop:test      # 改动桌面壳时运行
npm run test:e2e:desktop  # 改动桌面主进程/preload/IPC 时运行
```

如果只修改文档，可以跳过浏览器测试，但请确保 `npm run lint` 通过且链接与事实准确。

## 代码边界

- `src/core` 只能包含纯 TypeScript 领域逻辑，不得引用 React、DOM、SheetJS、`docx` 或 `localStorage`。
- 第三方文件格式和宿主 API 放在 `src/adapters`。
- React 组件只负责展示和派发用户操作，不复制核心计算逻辑。
- 导出默认使用已确认的 `baseline`；草稿版导出必须明确标注来源，不得篡改已确认基线。
- 桌面端所有文件写入与定位必须经过 `PathAuthorizer` 会话级白名单；禁止向渲染进程暴露任意文件系统访问。
- 访问令牌只存内存，刷新令牌走 HttpOnly Cookie；密钥不得进入仓库、日志、`localStorage` 或项目文件。
- 新行为必须配对单元测试（修复 Bug 先补复现测试，修改交互同步更新 E2E）。

## 5 分钟贡献示例：新增一个沙盘场景模板

如果你想快速提交第一个 PR，添加一个内置业务场景模板是最顺手的切入点：

1. 打开 [src/core/templates.ts](src/core/templates.ts)，仿照 `budgetDemo` / `revenueDemo` 新增一份虚构 `SalesData`（3–6 行）与 1–2 个能触发指标/排名变化的 `ScenarioPreset`，将其加入 `SCENARIO_TEMPLATES` 数组。
2. 运行 `npx vitest run tests/core/templates.test.ts`——现有测试会自动校验新模板的数据结构合法性、不可变性以及每个预设都能产生真实影响项。
3. 运行 `npm run verify` 确认类型、测试、E2E 和构建全绿。
4. 创建聚焦的小分支提交 PR（例如 `feat(templates): add inventory turnover scenario template`）。

## 适合首次贡献的任务

查看 GitHub 上带 `good first issue` / `help wanted` 标签的真实议题，例如：

- 新增实用业务场景模板或自定义金额单位/列标题。
- 支持多步撤销 / 重做（Undo / Redo）草稿编辑历史。
- 为 Word 导出增加汇总表格或内嵌柱状图，或新增 PDF / 打印友好样式。
- 增加中英文 i18n 词条层与界面语言切换。
- 改进错误提示、键盘操作和可访问性。
- 在真实 WPS 桌面客户端上完成兼容性验证并补充说明。

## 提交与 PR

1. 创建一个聚焦的小分支，不混入无关格式化或大规模重写。
2. 提交信息采用 Conventional Commits，例如 `feat(core): add undo stack`、`fix(cloud): handle conflict status`。
3. PR 描述说明问题、改动、测试证据和剩余限制。
4. 合并前确保 CI（`secret` / `web` / `api` / `docker` / `fullstack` / `desktop`）全部通过。
