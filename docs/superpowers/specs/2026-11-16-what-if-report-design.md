# What-if Report（数据沙盘）开源 MVP 设计

**日期：** 2026-11-16  
**状态：** 已确认设计，尚未开始实现  
**目标首版：** v0.1.0

## 1. 产品定义

What-if Report 是一个本地优先的表格修改影响预览工具。用户导入符合固定模板的 `.xlsx` 文件，在浏览器中试改数据，查看受影响的指标和报告结论，确认后导出更新后的 `.xlsx` 与 `.docx`。

首版只证明一条完整链路：

> 导入固定格式 Excel → 试改数据 → 预览影响并定位来源 → 应用或撤销 → 导出 Excel 和 Word。

产品不是通用办公 Agent、Excel 公式引擎或在线协作文档。

## 2. 目标用户与核心场景

首版用户是需要理解“一个数据变化会影响哪些经营结论”的分析人员、学生和办公工具开发者。

核心用户故事：

1. 作为用户，我可以下载模板并导入自己的表格，以便在不上传文件的情况下开始分析。
2. 作为用户，我可以试改一个或多个当前期数值，以便在不覆盖原数据的情况下观察影响。
3. 作为用户，我可以看到修改前后的指标、排名和报告文字，以便理解变化的业务含义。
4. 作为用户，我可以点击影响项定位来源单元格，以便核验系统结论。
5. 作为用户，我可以应用或放弃修改，以便控制最终导出内容。
6. 作为用户，我可以导出 WPS 能打开的 Excel 和 Word 文件，以便继续办公。
7. 作为贡献者，我可以独立测试核心计算，而不必启动 React 或理解文件格式。

## 3. 首版范围

### 3.1 必须包含

- 固定模板和虚构示例文件下载。
- `.xlsx` 导入、校验和明确错误提示。
- 原始指标及 HTML 报告展示。
- 一个或多个 `current` 单元格的草稿编辑。
- 总销售额、同比增长率、第一区域三项指标。
- 指标、排名、报告结论的影响列表。
- 来源单元格高亮。
- 应用全部修改与放弃全部草稿。
- 导出更新后的 `.xlsx` 和 `.docx`。
- 使用 `localStorage` 恢复未完成草稿，并允许主动清除。
- 核心单元测试、文件适配器测试和一条端到端测试。
- 静态部署，无账号、无服务端、无追踪脚本。

### 3.2 明确排除

- 任意 Excel 文件、任意公式、跨工作簿引用和公式求值。
- 外部文件修改监听和自动同步。
- WPS 加载项、WebOffice、多人协作、账号和云存储。
- 通用 AI 聊天、AI 数值计算、PPT 生成。
- 自定义指标、报告模板编辑器和插件市场。
- 自动覆盖用户原始文件。

## 4. 文件与数据契约

### 4.1 输入文件

- 文件扩展名必须为 `.xlsx`，大小不超过 10 MiB。
- 必须存在名为 `Sales` 的工作表。
- 第一行表头依次为 `region`、`previous`、`current`。
- 数据从第二行开始，至少一行，最多 1000 行。
- `region` 为非空且去重后的字符串。
- `previous` 和 `current` 必须是直接填写的有限非负数字；公式单元格、空值、文本数字、负数、NaN 和 Infinity 均拒绝。
- 导入失败时保留当前项目，不用错误文件覆盖状态。

示例：

| region | previous | current |
|---|---:|---:|
| 华东 | 100 | 120 |
| 华西 | 90 | 100 |
| 华北 | 60 | 80 |

初始结果：当前总额 300、上期总额 250、同比增长率 20%、第一区域华东。将华东 `current` 从 120 改为 90 后：当前总额 270、同比增长率 8%、第一区域华西。

### 4.2 内部类型

```ts
export interface SalesRegion {
  id: string;
  name: string;
  previous: number;
  current: number;
  previousCell: string;
  currentCell: string;
}

export interface SalesData {
  regions: SalesRegion[];
}

export interface Metrics {
  totalCurrent: number;
  totalPrevious: number;
  growthRate: number | null;
  topRegionId: string | null;
}

export type ImpactKind = "metric" | "ranking" | "narrative";

export interface Impact {
  id: "totalCurrent" | "growthRate" | "topRegionId" | "summary" | "growthNarrative" | "leaderNarrative";
  kind: ImpactKind;
  label: string;
  before: string;
  after: string;
  sourceCells: string[];
}

export interface ReportBlock {
  id: "summary" | "growthNarrative" | "leaderNarrative";
  text: string;
  sourceCells: string[];
}

export interface ReportModel {
  title: "销售数据修改影响报告";
  blocks: ReportBlock[];
}

export interface ProjectSnapshot {
  schemaVersion: 1;
  baseline: SalesData;
  draft: SalesData;
  updatedAt: string;
}
```

`id` 使用稳定、唯一的区域标识；首版由导入顺序生成 `region-1`、`region-2` 等，展示名称仍使用原始 `region`。

### 4.3 核心接口

```ts
export function computeMetrics(data: SalesData): Metrics;
export function compareSnapshots(baseline: SalesData, draft: SalesData): Impact[];
export function buildReport(data: SalesData, metrics: Metrics): ReportModel;
export function validateSalesData(value: unknown): SalesData;
export function parseSalesWorkbook(workbook: WorkBook): SalesData;
export function createSalesWorkbook(data: SalesData): WorkBook;
export function createWordReport(data: SalesData, report: ReportModel): Promise<Blob>;
export function loadProject(): ProjectSnapshot | null;
export function saveProject(snapshot: ProjectSnapshot): void;
export function clearProject(): void;
```

`core` 中的 `computeMetrics`、`compareSnapshots`、`buildReport` 和 `validateSalesData` 不引用 React、DOM、SheetJS、docx 或 localStorage。`WorkBook` 类型通过 `import type { WorkBook } from "xlsx"` 仅在 Excel 适配器中使用；React 页面不直接操作 SheetJS。

## 5. 计算与展示规则

- `totalCurrent`：所有区域 `current` 之和。
- `totalPrevious`：所有区域 `previous` 之和。
- `growthRate`：当 `totalPrevious > 0` 时为 `(totalCurrent - totalPrevious) / totalPrevious`，否则为 `null`，界面显示“不适用”。
- `topRegionId`：当至少有一个区域且 `totalCurrent > 0` 时，取最大 `current` 的区域；并列时按导入顺序取第一个；总额为零时为 `null`。
- 增长率以百分比展示，四舍五入到两位小数；计算过程保留原始数值，不用格式化后的字符串参与后续计算。
- 金额保持输入单位，示例报告使用“万元”，首版不做币种或单位换算。
- 报告使用确定性中文模板，不调用 AI。

## 6. 状态与交互

状态包含：

- `baseline`：已确认数据。
- `draft`：正在试改的数据。
- `selectedImpactId`：当前选中的影响项。
- `sourceCells`：需要高亮的来源单元格。
- `importError`、`storageWarning`、`exportError`、`notice`：非敏感界面状态。

行为：

1. 编辑只改变 `draft`，并同步重算指标、报告和影响列表。
2. 应用修改将 `draft` 深拷贝为新 `baseline`，清空影响项和选中状态。
3. 撤销将 `baseline` 深拷贝为 `draft`，清空影响项和选中状态。
4. 点击影响项时，同时高亮对应来源单元格和报告块。
5. 点击“清除本地项目”需要二次确认，然后移除本地存储并恢复虚构示例。
6. 导出只使用已确认的 `baseline`；存在未应用草稿时，明确提示“导出已确认版本，不包含未应用草稿”。

## 7. 页面结构

首版采用三栏桌面布局、单栏移动布局：

1. 数据表格：允许编辑 `current`，`previous` 只读。
2. 影响列表：展示变化前后值、类型和来源按钮。
3. 报告预览：并排或切换展示原始报告与草稿报告。

顶部操作：下载模板、导入、应用、撤销、导出 Excel、导出 Word、清除本地项目。移动端保证操作按钮可访问，不以横向滚动作为唯一操作方式。

## 8. 本地持久化与隐私

- 存储键为 `what-if-report:project:v1`。
- 保存 `ProjectSnapshot`，不保存 File/Blob、错误堆栈或界面提示。
- 每次 `baseline` 或 `draft` 变化后保存；恢复时重新执行结构校验。
- localStorage 不可用、超额或数据损坏时，不阻塞当前使用，显示非敏感警告并允许继续。
- 文件内容不发送到任何服务端，不写入日志，不包含分析或广告脚本。
- 文档要求用户仅提交虚构样例，不得在公开 Issue 中上传真实业务文件。

## 9. 导入导出

### Excel

导入只接受第 4 节约定的文件。导出保留 `Sales` 表头与区域顺序，以当前 `baseline` 写入 `previous` 和 `current`，并保留来源单元格映射。首版不承诺保留原文件样式、公式、图表、隐藏表或其他工作表；导出新文件，不覆盖原文件。

### Word

导出的 `.docx` 包含标题、生成时间、指标摘要、报告块和来源说明。Word 内容来自当前 `baseline` 及其 `ReportModel`，不使用未应用草稿。导出失败时保留当前状态并显示可理解的错误。

## 10. 错误处理

- 非法扩展名、超大文件、缺少 `Sales`、表头不符、重复区域、非法数值：在导入区显示具体原因。
- 空数据、公式单元格、超过 1000 行：拒绝导入并说明修改方式。
- 本地存储失败：非阻塞警告，不影响编辑和导出。
- 导出失败：保留当前项目，允许重试。
- 未知异常：界面显示通用错误，控制台仅记录不含文件内容的诊断信息。

## 11. 技术方案

- React + TypeScript + Vite，浏览器端静态应用。
- npm 管理依赖。
- Vitest 测试 core 和适配器。
- Playwright 测试完整用户链路。
- SheetJS 处理 `.xlsx`；`docx` 生成 Word。
- React `useReducer` 管理项目状态。
- CSS Modules 或普通 CSS，避免引入大型 UI 框架。
- GitHub Actions 执行测试、类型检查和构建；GitHub Pages 部署静态站点。

## 12. 测试与验收

### 核心测试

- 总额、增长率、排名及并列规则正确。
- 上期总额为零时增长率为 `null`，当前总额为零时第一区域为 `null`。
- 华东 120→90 得到总额 300→270、增长率 20%→8%、第一区域华东→华西。
- 未变化数据不产生 Impact。
- 应用和撤销遵守状态契约。

### 文件与端到端测试

- 合法示例可导入；缺少工作表、表头错误、重复区域、公式单元格和非法数值均被拒绝。
- 导出的 Excel 与 Word 使用同一已确认数据。
- 用户能完成导入→试改→定位→应用→导出。
- 刷新后恢复草稿，清除后恢复示例。

### 首版完成条件

- 陌生用户通过静态链接完成完整流程，无需注册。
- 导出的两个文件可由 WPS 打开，内容一致。
- 页面加载后的核心流程不发起网络请求，本地存储恢复符合契约；首版不承诺离线首次打开或离线刷新。
- 新开发者按 README 在本地安装、测试和构建成功。
- CI 的类型检查、单元测试、端到端测试和构建全部通过。

## 13. 开源与发布

首版仓库采用 MIT License，包含 README、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、ROADMAP、CHANGELOG、Issue/PR 模板和虚构示例。公开仓库和 GitHub Pages 发布在本地验收后进行。

优先开放文档、测试、错误提示、可访问性、翻译、CSV 和报告样式等小型贡献任务。首版不接受重写核心、通用公式引擎或泛化办公平台等失去边界的贡献。

## 14. 后续路线

- v0.2.0：CSV、列映射、项目文件导入导出、更多真实数据校验。
- v0.3.0：自定义指标、报告块和简单图表。
- v0.4.0：可选 AI 文案润色，确定性模板回退，AI 不参与数值计算。
- v0.5.0：验证 WPS 加载项，并复用 core。
- v1.0.0：稳定数据格式、迁移机制、文档和发布流程。
