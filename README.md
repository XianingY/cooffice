# What-if Report（数据沙盘）

一个本地优先的表格修改影响预览工具：导入固定格式的 Excel，在浏览器中试改数据，查看指标和报告结论会受到什么影响，确认后导出新的 Excel 和 Word。

> **项目状态：设计与计划阶段。** 当前仓库包含产品设计和实现计划，尚未发布可运行的 v0.1.0。下文中的用户功能均指首版目标，不代表已经完成。

## 首版目标

- 导入固定结构的 `.xlsx` 销售数据。
- 在不修改原始数据的情况下试改当前期数值。
- 预览总销售额、同比增长率、区域排名和报告结论的变化。
- 点击影响项，定位来源单元格。
- 应用或撤销草稿。
- 导出更新后的 `.xlsx` 和 `.docx`，继续使用 WPS 等办公软件处理。
- 在本地保存和恢复草稿。

## 隐私原则

- 文件只在浏览器本地处理，不上传服务器。
- 不需要账号，不包含分析、广告或追踪脚本。
- 原始文件不会被覆盖。
- 页面加载后的核心流程不发起携带文件内容的网络请求。

首版不承诺离线首次打开或离线刷新。

## 首版输入格式

文件必须是 `.xlsx`，包含 `Sales` 工作表，表头如下：

| region | previous | current |
|---|---:|---:|
| 华东 | 100 | 120 |
| 华西 | 90 | 100 |
| 华北 | 60 | 80 |

限制：文件不超过 10 MiB，数据为 1～1000 行，区域名称唯一，数值为直接填写的非负有限数字。公式、文本数字、空值和负数不被接受。

## 首版不做什么

- 不解析任意 Excel 文件或公式。
- 不做 WPS 加载项、在线协作或云同步。
- 不提供通用 AI 聊天或 AI 数值计算。
- 不支持自定义指标、报告模板或插件市场。

这些边界用于保证首版的正确性、可测试性和可维护性。

## 技术方案

React、TypeScript、Vite、Vitest、Playwright、SheetJS 和 docx。核心计算与 React、浏览器和文件格式解耦，便于以后复用到命令行或 WPS 加载项。

```text
Excel 文件 → 适配器 → 纯 TypeScript core → React 影响预览
                         ↓
                 Excel / Word 导出
```

## 文档

- [开源 MVP 设计](docs/superpowers/specs/2026-11-16-what-if-report-design.md)
- [文件级实现计划](docs/superpowers/plans/2026-11-16-what-if-report-mvp.md)
- [路线图](ROADMAP.md)
- [贡献指南](CONTRIBUTING.md)
- [安全与隐私说明](SECURITY.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [变更记录](CHANGELOG.md)

## 本地开发

项目采用 npm。首版代码落地后，标准命令为：

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run build
```

当前处于计划阶段，这些脚本将随首版代码提供。

## 贡献

欢迎文档、测试、错误提示、可访问性、翻译和小范围文件格式改进。开始之前请阅读[贡献指南](CONTRIBUTING.md)和[路线图](ROADMAP.md)。

首版不接受“支持所有 Excel 公式”“重写为通用办公平台”等扩大边界的提案。

## License

[MIT](LICENSE) © 2026 What-if Report contributors
