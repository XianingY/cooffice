# 贡献指南

感谢你愿意改进 What-if Report。项目优先保证正确性、可验证性和小步交付，而不是快速堆叠功能。

## 开始前

1. 阅读 [README](README.md)、[设计文档](docs/superpowers/specs/2026-11-16-what-if-report-design.md)和[路线图](ROADMAP.md)。
2. 对较大改动先创建 Issue，说明用户问题、建议范围和验收标准。
3. 不在 Issue、PR、测试数据或截图中提交真实业务文件、个人信息、密钥或内部地址。

## 本地环境

首版使用 Node.js 22 和 npm。代码发布后，使用：

```bash
npm ci
npm run dev
```

提交前必须通过：

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

如果只修改文档，可以不运行浏览器测试，但应检查链接、文件路径和事实表述。

## 代码边界

- `src/core` 只能包含纯 TypeScript 领域逻辑，不得引用 React、DOM、SheetJS、docx 或 localStorage。
- 第三方文件格式和浏览器 API 放在 `src/adapters`。
- React 组件只负责展示和派发用户操作，不复制核心计算。
- 新行为必须先写失败测试，再做最小实现。
- 导出只能使用已确认的 `baseline`，不得包含未应用草稿。
- 不为了通过测试而删除断言、放宽校验或引入服务端。

## 测试要求

- 修复 bug：增加能复现问题的测试。
- 新功能：增加正常路径和相关边界测试。
- 修改用户流程：更新 Playwright 测试。
- 修改输入格式：同步更新校验、示例、README 和设计文档。

## 提交与 PR

1. 创建一个聚焦的小分支，不混入无关格式化或重构。
2. 提交信息使用祈使式且说明行为，例如 `feat: preview ranking impacts`。
3. PR 描述说明问题、改动、测试证据和剩余限制。
4. 接受代码审查，并回应 AI 生成代码与人工编写代码的相同正确性要求。
5. 合并前确保 CI 全部通过。

## 适合首次贡献的任务

- 增加非法输入测试。
- 改进错误提示、键盘操作和可访问性。
- 完善文档、翻译和虚构示例。
- 优化 Word 报告样式。
- 在路线图对应版本中实现 CSV 等小范围适配器。

首版不接受通用公式引擎、账号系统、云同步、多人协作或整体架构重写。
