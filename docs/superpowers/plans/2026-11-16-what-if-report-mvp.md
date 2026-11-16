# What-if Report Open-Source MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first React application that imports a constrained `.xlsx` sales file, previews metric and narrative impacts from draft edits, and exports confirmed `.xlsx` and `.docx` files without sending data to a server.

**Architecture:** Pure TypeScript domain modules calculate metrics, impacts and report models. React only renders project state, while Excel, Word and localStorage adapters isolate browser/third-party APIs. The same baseline/draft snapshot supports editing, apply/revert and local recovery.

**Tech Stack:** React, TypeScript, Vite, npm, SheetJS (`xlsx`), `docx`, Vitest, Testing Library, Playwright, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-16-what-if-report-design.md`

## Global Constraints

- First release is v0.1.0; do not claim functionality before it is implemented and tested.
- Only the `Sales` worksheet and exact headers `region`, `previous`, `current` are accepted.
- Reject files larger than 10 MiB, more than 1000 data rows, formulas, text numbers, empty values, negative numbers, NaN and Infinity.
- Core modules never import React, DOM, `xlsx`, `docx` or localStorage.
- AI, arbitrary formulas, external file watchers, WPS add-ins, accounts, backend services and analytics are excluded.
- Export uses `baseline`, never unapplied `draft`; never overwrite the original file.
- localStorage key is `what-if-report:project:v1`; `schemaVersion` is `1`.
- Use Chinese UI copy and deterministic report templates. Format growth to two decimal places only for display.
- Page-loaded core flows make no network request. Offline first load and offline refresh are not promised.
- Public issues and test fixtures must not contain real business or personal data.

## File Map

- `src/core/types.ts`: shared domain contracts.
- `src/core/metrics.ts`: total, growth and ranking calculations.
- `src/core/report.ts`: deterministic report model generation.
- `src/core/impacts.ts`: baseline/draft impact comparison.
- `src/core/validation.ts`: runtime SalesData validation.
- `src/fixtures/salesDemo.ts`: canonical three-region example.
- `src/adapters/xlsx/salesWorkbook.ts`: workbook parsing, export and template generation.
- `src/adapters/docx/createWordReport.ts`: Word Blob generation.
- `src/adapters/storage/projectStorage.ts`: versioned local persistence.
- `src/state/projectReducer.ts`: edit/apply/revert/import/clear transitions.
- `src/components/*`: focused UI components.
- `src/App.tsx`: composition and derived render state.
- `tests/**`: unit and adapter tests; `e2e/project.spec.ts`: full browser flow.
- `scripts/create-example.mjs`: creates public sample/template workbooks.
- `.github/workflows/ci.yml`: install, typecheck, unit tests, e2e and build.

---

### Task 1: Scaffold and Domain Contracts

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `.gitignore`
- Create: `src/main.tsx`, `src/vite-env.d.ts`, `src/App.tsx`, `src/styles.css`, `tests/ui/setup.ts`
- Create: `src/core/types.ts`, `src/fixtures/salesDemo.ts`
- Test: `tests/core/sample.test.ts`

**Interfaces:**
- Produces: `SalesRegion`, `SalesData`, `Metrics`, `Impact`, `ReportBlock`, `ReportModel`, `ProjectSnapshot`, `salesDemo`.

- [ ] **Step 1: Write package configuration and a failing fixture test**

`package.json`:

```json
{
  "name": "what-if-report",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "example:generate": "node scripts/create-example.mjs"
  },
  "dependencies": {
    "docx": "^9.5.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "typescript": "~5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.7"
  }
}
```

`tests/core/sample.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";

describe("salesDemo", () => {
  it("contains the confirmed three-region example", () => {
    expect(salesDemo.regions.map((region) => [region.name, region.previous, region.current])).toEqual([
      ["华东", 100, 120],
      ["华西", 90, 100],
      ["华北", 60, 80],
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm the fixture is missing**

Run: `npm install && npx vitest run tests/core/sample.test.ts`  
Expected: FAIL because `src/fixtures/salesDemo.ts` does not exist.

- [ ] **Step 3: Add the domain contracts and fixture**

`src/core/types.ts`:

```ts
export interface SalesRegion {
  id: string;
  name: string;
  previous: number;
  current: number;
  previousCell: string;
  currentCell: string;
}

export interface SalesData { regions: SalesRegion[]; }

export interface Metrics {
  totalCurrent: number;
  totalPrevious: number;
  growthRate: number | null;
  topRegionId: string | null;
}

export type ImpactId = "totalCurrent" | "growthRate" | "topRegionId" | "summary" | "growthNarrative" | "leaderNarrative";
export type ImpactKind = "metric" | "ranking" | "narrative";

export interface Impact {
  id: ImpactId;
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

`src/fixtures/salesDemo.ts`:

```ts
import type { SalesData } from "../core/types";

export const salesDemo: SalesData = {
  regions: [
    { id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" },
    { id: "region-2", name: "华西", previous: 90, current: 100, previousCell: "B3", currentCell: "C3" },
    { id: "region-3", name: "华北", previous: 60, current: 80, previousCell: "B4", currentCell: "C4" },
  ],
};
```

Add the executable scaffold:

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./tests/ui/setup.ts", exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"] },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src", "tests", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`index.html` contains `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`. `src/main.tsx` mounts App with `createRoot(document.getElementById("root")!).render(<App />)`. `src/App.tsx` initially returns `<main><h1>销售数据修改影响报告</h1></main>`. `src/vite-env.d.ts` contains `/// <reference types="vite/client" />`.

`tests/ui/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

beforeEach(() => localStorage.clear());
```

`.gitignore` contains `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, `.env`, `.env.*` and `!.env.example`.

- [ ] **Step 4: Verify the fixture test and TypeScript build**

Run: `npx vitest run tests/core/sample.test.ts && npm run typecheck`  
Expected: one test passes; TypeScript reports no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json .gitignore src tests/core/sample.test.ts
git commit -m "chore: scaffold app and domain contracts"
```

### Task 2: Metric Calculation

**Files:**
- Create: `src/core/metrics.ts`, `src/core/format.ts`
- Test: `tests/core/metrics.test.ts`

**Interfaces:**
- Consumes: `SalesData`, `Metrics`.
- Produces: `computeMetrics(data: SalesData): Metrics`, `formatGrowth(value: number | null): string`.

- [ ] **Step 1: Write failing metric tests**

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { computeMetrics } from "../../src/core/metrics";
import { formatGrowth } from "../../src/core/format";

const edit = (current: number) => ({
  regions: salesDemo.regions.map((region, index) => index === 0 ? { ...region, current } : { ...region }),
});

describe("computeMetrics", () => {
  it("calculates the baseline", () => {
    expect(computeMetrics(salesDemo)).toEqual({ totalCurrent: 300, totalPrevious: 250, growthRate: 0.2, topRegionId: "region-1" });
  });
  it("recalculates the edited example", () => {
    expect(computeMetrics(edit(90))).toEqual({ totalCurrent: 270, totalPrevious: 250, growthRate: 0.08, topRegionId: "region-2" });
  });
  it("uses null for undefined growth and zero-total leader", () => {
    expect(computeMetrics({ regions: [{ ...salesDemo.regions[0], previous: 0, current: 0 }] })).toEqual({ totalCurrent: 0, totalPrevious: 0, growthRate: null, topRegionId: null });
  });
  it("uses import order for ties", () => {
    expect(computeMetrics(edit(100)).topRegionId).toBe("region-1");
  });
});

it("formats growth only for display", () => {
  expect(formatGrowth(0.08)).toBe("8.00%");
  expect(formatGrowth(null)).toBe("不适用");
});
```

- [ ] **Step 2: Run tests and verify missing exports**

Run: `npx vitest run tests/core/metrics.test.ts`  
Expected: FAIL because `computeMetrics` and `formatGrowth` do not exist.

- [ ] **Step 3: Implement deterministic calculations**

```ts
import type { Metrics, SalesData } from "./types";

export function computeMetrics(data: SalesData): Metrics {
  const totalCurrent = data.regions.reduce((sum, region) => sum + region.current, 0);
  const totalPrevious = data.regions.reduce((sum, region) => sum + region.previous, 0);
  const leader = totalCurrent > 0 ? data.regions.find((region) => region.current === Math.max(...data.regions.map((item) => item.current))) : undefined;
  return {
    totalCurrent,
    totalPrevious,
    growthRate: totalPrevious > 0 ? (totalCurrent - totalPrevious) / totalPrevious : null,
    topRegionId: leader?.id ?? null,
  };
}
```

`src/core/format.ts`:

```ts
export function formatGrowth(value: number | null): string {
  return value === null ? "不适用" : `${(value * 100).toFixed(2)}%`;
}
```

- [ ] **Step 4: Verify all metric tests**

Run: `npx vitest run tests/core/metrics.test.ts`  
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/metrics.ts src/core/format.ts tests/core/metrics.test.ts
git commit -m "feat: calculate sales metrics"
```

### Task 3: Report Model and Impact Analysis

**Files:**
- Create: `src/core/report.ts`, `src/core/impacts.ts`
- Test: `tests/core/report.test.ts`, `tests/core/impacts.test.ts`

**Interfaces:**
- Consumes: `computeMetrics`, `formatGrowth`, domain types.
- Produces: `buildReport(data, metrics): ReportModel`, `compareSnapshots(baseline, draft): Impact[]`.

- [ ] **Step 1: Write failing report and impact tests**

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { computeMetrics } from "../../src/core/metrics";
import { buildReport } from "../../src/core/report";
import { compareSnapshots } from "../../src/core/impacts";

const edited = { regions: salesDemo.regions.map((region, index) => index === 0 ? { ...region, current: 90 } : { ...region }) };

it("builds deterministic report blocks with evidence", () => {
  const report = buildReport(salesDemo, computeMetrics(salesDemo));
  expect(report.blocks.map((block) => block.text)).toEqual([
    "当前总销售额为 300 万元。",
    "同比增长率为 20.00%。",
    "华东销售额最高。",
  ]);
  expect(report.blocks[0].sourceCells).toEqual(["C2", "C3", "C4"]);
});

it("returns all expected impacts and no false positives", () => {
  const impacts = compareSnapshots(salesDemo, edited);
  expect(impacts.map((impact) => impact.id)).toEqual(["totalCurrent", "growthRate", "topRegionId", "summary", "growthNarrative", "leaderNarrative"]);
  expect(compareSnapshots(salesDemo, salesDemo)).toEqual([]);
  expect(impacts[0].before).toBe("300 万元");
  expect(impacts[0].after).toBe("270 万元");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/core/report.test.ts tests/core/impacts.test.ts`  
Expected: FAIL because report and impact modules are missing.

- [ ] **Step 3: Implement report and comparison**

`src/core/report.ts`:

```ts
import { formatGrowth } from "./format";
import type { Metrics, ReportModel, SalesData } from "./types";

export function buildReport(data: SalesData, metrics: Metrics): ReportModel {
  const currentCells = data.regions.map((region) => region.currentCell);
  const previousCells = data.regions.map((region) => region.previousCell);
  const leader = data.regions.find((region) => region.id === metrics.topRegionId);
  return {
    title: "销售数据修改影响报告",
    blocks: [
      { id: "summary", text: `当前总销售额为 ${metrics.totalCurrent} 万元。`, sourceCells: currentCells },
      { id: "growthNarrative", text: `同比增长率为 ${formatGrowth(metrics.growthRate)}。`, sourceCells: [...previousCells, ...currentCells] },
      { id: "leaderNarrative", text: leader ? `${leader.name}销售额最高。` : "暂无销售额第一区域。", sourceCells: leader ? [leader.currentCell] : currentCells },
    ],
  };
}
```

`src/core/impacts.ts`:

```ts
import { formatGrowth } from "./format";
import { computeMetrics } from "./metrics";
import { buildReport } from "./report";
import type { Impact, ImpactId, ImpactKind, SalesData } from "./types";

export function compareSnapshots(baseline: SalesData, draft: SalesData): Impact[] {
  const before = computeMetrics(baseline);
  const after = computeMetrics(draft);
  const beforeReport = buildReport(baseline, before);
  const afterReport = buildReport(draft, after);
  const impacts: Impact[] = [];
  const add = (id: ImpactId, kind: ImpactKind, label: string, beforeText: string, afterText: string, sourceCells: string[]) => {
    if (beforeText !== afterText) impacts.push({ id, kind, label, before: beforeText, after: afterText, sourceCells });
  };
  const currentCells = draft.regions.map((region) => region.currentCell);
  const previousCells = draft.regions.map((region) => region.previousCell);
  const beforeLeader = baseline.regions.find((region) => region.id === before.topRegionId);
  const afterLeader = draft.regions.find((region) => region.id === after.topRegionId);

  add("totalCurrent", "metric", "总销售额", `${before.totalCurrent} 万元`, `${after.totalCurrent} 万元`, currentCells);
  add("growthRate", "metric", "同比增长率", formatGrowth(before.growthRate), formatGrowth(after.growthRate), [...previousCells, ...currentCells]);
  add("topRegionId", "ranking", "第一区域", beforeLeader?.name ?? "无", afterLeader?.name ?? "无", [...new Set([...(beforeLeader ? [beforeLeader.currentCell] : []), ...(afterLeader ? [afterLeader.currentCell] : [])])]);

  const labels = { summary: "总额结论", growthNarrative: "增长率结论", leaderNarrative: "排名结论" } as const;
  for (const beforeBlock of beforeReport.blocks) {
    const afterBlock = afterReport.blocks.find((block) => block.id === beforeBlock.id)!;
    add(beforeBlock.id, "narrative", labels[beforeBlock.id], beforeBlock.text, afterBlock.text, afterBlock.sourceCells);
  }
  return impacts;
}
```

The function does not mutate either input and returns impacts in the tested order.

- [ ] **Step 4: Verify report and impact tests**

Run: `npx vitest run tests/core/report.test.ts tests/core/impacts.test.ts`  
Expected: all tests pass, including empty comparison.

- [ ] **Step 5: Commit**

```bash
git add src/core/report.ts src/core/impacts.ts tests/core/report.test.ts tests/core/impacts.test.ts
git commit -m "feat: preview report and metric impacts"
```

### Task 4: Runtime Validation and Excel Adapter

**Files:**
- Create: `src/core/validation.ts`, `src/adapters/xlsx/salesWorkbook.ts`
- Create: `scripts/create-example.mjs`, `public/templates/.gitkeep`
- Test: `tests/core/validation.test.ts`, `tests/adapters/salesWorkbook.test.ts`

**Interfaces:**
- Produces: `validateSalesData(value: unknown): SalesData`, `parseSalesWorkbook(workbook: WorkBook): SalesData`, `createSalesWorkbook(data: SalesData): WorkBook`, `readSalesFile(file: File): Promise<SalesData>`.
- The adapter owns all `xlsx` imports. It maps rows to `region-${index + 1}` and cells to B/C plus the spreadsheet row number.

- [ ] **Step 1: Write failing validation and workbook tests**

```ts
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { createSalesWorkbook, parseSalesWorkbook } from "../../src/adapters/xlsx/salesWorkbook";

const roundTrip = () => parseSalesWorkbook(createSalesWorkbook(salesDemo));

describe("sales workbook", () => {
  it("round-trips valid data and source cells", () => {
    expect(roundTrip()).toEqual(salesDemo);
  });
  it("rejects a missing Sales worksheet", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["region"]]), "Other");
    expect(() => parseSalesWorkbook(book)).toThrow("缺少 Sales 工作表");
  });
  it("rejects formulas", () => {
    const book = createSalesWorkbook(salesDemo);
    book.Sheets.Sales.C2.f = "100+20";
    expect(() => parseSalesWorkbook(book)).toThrow("不能包含公式");
  });
  it("rejects duplicate regions and text numbers", () => {
    const book = createSalesWorkbook(salesDemo);
    book.Sheets.Sales.A3.v = "华东";
    expect(() => parseSalesWorkbook(book)).toThrow("区域名称不能重复");
    const second = createSalesWorkbook(salesDemo);
    second.Sheets.Sales.C2 = { t: "s", v: "120" } as XLSX.CellObject;
    expect(() => parseSalesWorkbook(second)).toThrow("非负数字");
  });
});
```

`tests/core/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { validateSalesData } from "../../src/core/validation";

describe("validateSalesData", () => {
  it("accepts the canonical fixture", () => expect(validateSalesData(salesDemo)).toEqual(salesDemo));
  it("rejects empty data", () => expect(() => validateSalesData({ regions: [] })).toThrow("至少包含一行"));
  it("rejects negative and non-finite values", () => {
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: -1 }] })).toThrow("非负数字");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: Number.NaN }] })).toThrow("非负数字");
  });
  it("rejects more than 1000 rows", () => {
    const regions = Array.from({ length: 1001 }, (_, index) => ({ ...salesDemo.regions[0], id: `region-${index + 1}`, name: `区域${index + 1}` }));
    expect(() => validateSalesData({ regions })).toThrow("不能超过 1000 行");
  });
});
```

- [ ] **Step 2: Run the adapter tests and verify failure**

Run: `npx vitest run tests/core/validation.test.ts tests/adapters/salesWorkbook.test.ts`  
Expected: FAIL because the validator and adapter are missing.

- [ ] **Step 3: Implement validation and workbook conversion**

`src/core/validation.ts` must throw Chinese `Error` messages and enforce the exact global constraints. Use this numeric guard:

```ts
function assertAmount(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}必须是有限的非负数字`);
  }
}
```

`readSalesFile` uses this size guard before reading:

```ts
if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MiB");
if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("只支持 .xlsx 文件");
const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellFormula: true });
return parseSalesWorkbook(workbook);
```

`src/core/validation.ts`:

```ts
import type { SalesData } from "./types";

export function validateSalesData(value: unknown): SalesData {
  if (typeof value !== "object" || value === null || !Array.isArray((value as SalesData).regions)) {
    throw new Error("销售数据结构无效");
  }
  const { regions } = value as SalesData;
  if (regions.length < 1) throw new Error("销售数据至少包含一行");
  if (regions.length > 1000) throw new Error("销售数据不能超过 1000 行");
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const region of regions) {
    if (typeof region !== "object" || region === null) throw new Error("区域数据无效");
    if (typeof region.id !== "string" || !region.id || typeof region.name !== "string" || !region.name) throw new Error("区域名称不能为空");
    if (names.has(region.name)) throw new Error("区域名称不能重复");
    if (ids.has(region.id)) throw new Error("区域标识不能重复");
    names.add(region.name);
    ids.add(region.id);
    for (const [key, label] of [["previous", "上期销售额"], ["current", "当前销售额"]] as const) {
      const amount = region[key];
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error(`${region.name}${label}必须是有限的非负数字`);
    }
    if (!/^B\d+$/.test(region.previousCell) || !/^C\d+$/.test(region.currentCell)) throw new Error("来源单元格映射无效");
    if (region.previousCell.slice(1) !== region.currentCell.slice(1)) throw new Error("来源单元格必须位于同一行");
  }
  return { regions: regions.map((region) => ({ ...region })) };
}
```

`src/adapters/xlsx/salesWorkbook.ts`:

```ts
import * as XLSX from "xlsx";
import { validateSalesData } from "../../core/validation";
import type { SalesData } from "../../core/types";

export function parseSalesWorkbook(workbook: XLSX.WorkBook): SalesData {
  const sheet = workbook.Sheets.Sales;
  if (!sheet) throw new Error("缺少 Sales 工作表");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
  if (rows.length < 2) throw new Error("销售数据至少包含一行");
  if (rows.length > 1001) throw new Error("销售数据不能超过 1000 行");
  const headers = rows[0].map(String);
  if (headers.join(",") !== "region,previous,current") throw new Error("表头必须依次为 region、previous、current");
  const regions = rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    if (sheet[`B${rowNumber}`]?.f || sheet[`C${rowNumber}`]?.f) throw new Error("输入文件不能包含公式");
    return {
      id: `region-${index + 1}`,
      name: row[0],
      previous: row[1],
      current: row[2],
      previousCell: `B${rowNumber}`,
      currentCell: `C${rowNumber}`,
    };
  });
  return validateSalesData({ regions });
}

export function createSalesWorkbook(data: SalesData): XLSX.WorkBook {
  const rows = data.regions.map((region) => [region.name, region.previous, region.current]);
  const sheet = XLSX.utils.aoa_to_sheet([["region", "previous", "current"], ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sales");
  return book;
}

export async function readSalesFile(file: File): Promise<SalesData> {
  if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MiB");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("只支持 .xlsx 文件");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellFormula: true });
  return parseSalesWorkbook(workbook);
}
```

`parseSalesWorkbook` rejects non-string region names before validation, so text numbers in amount columns reach the numeric validator unchanged.

`scripts/create-example.mjs`:

```js
import { mkdirSync } from "node:fs";
import * as XLSX from "xlsx";

const rows = [["region", "previous", "current"], ["华东", 100, 120], ["华西", 90, 100], ["华北", 60, 80]];
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sales");
mkdirSync("public/templates", { recursive: true });
XLSX.writeFile(book, "public/templates/sales-demo.xlsx");
XLSX.writeFile(book, "public/templates/sales-template.xlsx");
```

- [ ] **Step 4: Generate examples and verify tests**

Run: `node scripts/create-example.mjs && npx vitest run tests/core/validation.test.ts tests/adapters/salesWorkbook.test.ts`  
Expected: both files exist and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/validation.ts src/adapters/xlsx scripts/create-example.mjs public/templates tests/core/validation.test.ts tests/adapters/salesWorkbook.test.ts
git commit -m "feat: import and validate sales workbooks"
```

### Task 5: Project State and Versioned Local Persistence

**Files:**
- Create: `src/state/projectReducer.ts`, `src/adapters/storage/projectStorage.ts`
- Test: `tests/state/projectReducer.test.ts`, `tests/adapters/projectStorage.test.ts`

**Interfaces:**
- Produces: `ProjectState`, `ProjectAction`, `initialProjectState`, `projectReducer`, `loadProject`, `saveProject`, `clearProject`.
- Actions: `import`, `edit`, `apply`, `revert`, `selectImpact`, `clear`.

- [ ] **Step 1: Write failing reducer and storage tests**

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { initialProjectState, projectReducer } from "../../src/state/projectReducer";
import { clearProject, loadProject, saveProject } from "../../src/adapters/storage/projectStorage";

it("edits only draft, then applies and reverts", () => {
  const start = initialProjectState(salesDemo);
  const edited = projectReducer(start, { type: "edit", regionId: "region-1", value: 90 });
  expect(edited.baseline.regions[0].current).toBe(120);
  expect(edited.draft.regions[0].current).toBe(90);
  const applied = projectReducer(edited, { type: "apply" });
  expect(applied.baseline.regions[0].current).toBe(90);
  const reverted = projectReducer(edited, { type: "revert" });
  expect(reverted.draft).toEqual(edited.baseline);
});

it("round-trips a versioned snapshot and clears it", () => {
  saveProject({ schemaVersion: 1, baseline: salesDemo, draft: salesDemo, updatedAt: new Date().toISOString() });
  expect(loadProject()?.draft).toEqual(salesDemo);
  clearProject();
  expect(loadProject()).toBeNull();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/state/projectReducer.test.ts tests/adapters/projectStorage.test.ts --environment jsdom`  
Expected: FAIL because reducer and storage adapter are missing.

- [ ] **Step 3: Implement state transitions and storage**

`src/state/projectReducer.ts`:

```ts
import { salesDemo } from "../fixtures/salesDemo";
import type { ImpactId, SalesData } from "../core/types";

export interface ProjectState {
  baseline: SalesData;
  draft: SalesData;
  selectedImpactId: ImpactId | null;
  sourceCells: string[];
}

export type ProjectAction =
  | { type: "import"; data: SalesData }
  | { type: "edit"; regionId: string; value: number }
  | { type: "apply" }
  | { type: "revert" }
  | { type: "selectImpact"; id: ImpactId | null; sourceCells: string[] }
  | { type: "clear" };

export function initialProjectState(data: SalesData): ProjectState {
  return { baseline: structuredClone(data), draft: structuredClone(data), selectedImpactId: null, sourceCells: [] };
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  if (action.type === "clear") return initialProjectState(salesDemo);
  if (action.type === "import") return initialProjectState(action.data);
  if (action.type === "apply") return initialProjectState(state.draft);
  if (action.type === "revert") return { ...state, draft: structuredClone(state.baseline), selectedImpactId: null, sourceCells: [] };
  if (action.type === "selectImpact") return { ...state, selectedImpactId: action.id, sourceCells: action.sourceCells };
  if (!Number.isFinite(action.value) || action.value < 0) return state;
  const draft = structuredClone(state.draft);
  const region = draft.regions.find((item) => item.id === action.regionId);
  if (!region) return state;
  region.current = action.value;
  return { ...state, draft, selectedImpactId: null, sourceCells: [] };
}
```

`projectStorage.ts` uses this exact key and shape:

```ts
import type { ProjectSnapshot } from "../../core/types";
import { validateSalesData } from "../../core/validation";

const STORAGE_KEY = "what-if-report:project:v1";

export function saveProject(snapshot: ProjectSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

`loadProject` is implemented as follows; `getItem` exceptions reach the caller, while malformed JSON/schema returns `null`:

```ts
export function loadProject(): ProjectSnapshot | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as ProjectSnapshot;
    if (value.schemaVersion !== 1 || typeof value.updatedAt !== "string") return null;
    return {
      schemaVersion: 1,
      baseline: validateSalesData(value.baseline),
      draft: validateSalesData(value.draft),
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
```

`saveProject` and `clearProject` exceptions also reach the caller, which converts them into a non-blocking warning without logging file content.

- [ ] **Step 4: Verify reducer and persistence tests**

Run: `npx vitest run tests/state/projectReducer.test.ts tests/adapters/projectStorage.test.ts --environment jsdom`  
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/projectReducer.ts src/adapters/storage/projectStorage.ts tests/state/projectReducer.test.ts tests/adapters/projectStorage.test.ts
git commit -m "feat: manage draft state and local recovery"
```

### Task 6: Three-Panel UI and Source Navigation

**Files:**
- Create: `src/components/FileImport.tsx`, `src/components/SalesTable.tsx`, `src/components/ImpactList.tsx`, `src/components/ReportPreview.tsx`, `src/components/Toolbar.tsx`, `src/components/StatusMessage.tsx`, `src/components/ConfirmClearDialog.tsx`
- Modify: `src/App.tsx`, `src/styles.css`, `tests/ui/setup.ts`
- Test: `tests/ui/App.test.tsx`

**Interfaces:**
- `SalesTable`: `{ data: SalesData; sourceCells: string[]; onEdit(regionId: string, value: number): void }`.
- `ImpactList`: `{ impacts: Impact[]; selectedImpactId: ImpactId | null; onSelect(impact: Impact): void }`.
- `ReportPreview`: `{ baselineReport: ReportModel; draftReport: ReportModel; sourceCells: string[] }`.
- `FileImport`: `{ onImport(data: SalesData): void; onError(message: string): void }`.
- `Toolbar`: callbacks for apply, revert and clear; Excel/Word callbacks are added in Task 7.

- [ ] **Step 1: Write a failing UI test for the canonical interaction**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("impact preview", () => {
  it("previews the east edit and navigates to evidence", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("华东当前销售额");
    await user.clear(input);
    await user.type(input, "90");
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
    expect(screen.getByText("20.00% → 8.00%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看总销售额来源" }));
    expect(input).toHaveClass("source-cell");
    expect(screen.getByText("当前总销售额为 270 万元。")).toHaveClass("source-report");
  });
});
```

- [ ] **Step 2: Run the UI test and verify failure**

Run: `npx vitest run tests/ui/App.test.tsx --environment jsdom`  
Expected: FAIL because the labeled editor and impact controls are not implemented.

- [ ] **Step 3: Implement components and App composition**

`App` derives `baselineMetrics`, `draftMetrics`, `baselineReport`, `draftReport` and `impacts` from reducer state. It persists only baseline/draft after project changes, catches storage errors without logging file content, and renders import/storage/export messages through `StatusMessage`.

Use an accessible numeric input for every region:

```tsx
<label>
  <span className="sr-only">{region.name}当前销售额</span>
  <input
    aria-label={`${region.name}当前销售额`}
    className={sourceCells.includes(region.currentCell) ? "source-cell" : ""}
    type="number"
    min="0"
    step="any"
    value={region.current}
    onChange={(event) => onEdit(region.id, event.target.value === "" ? 0 : event.target.valueAsNumber)}
  />
</label>
```

`App` uses this reducer composition (exports are added in Task 7):

```tsx
const [state, dispatch] = useReducer(projectReducer, salesDemo, initialProjectState);
const [storageWarning, setStorageWarning] = useState("");
const [importError, setImportError] = useState("");
const [clearDialogOpen, setClearDialogOpen] = useState(false);
const baselineMetrics = useMemo(() => computeMetrics(state.baseline), [state.baseline]);
const draftMetrics = useMemo(() => computeMetrics(state.draft), [state.draft]);
const baselineReport = useMemo(() => buildReport(state.baseline, baselineMetrics), [state.baseline, baselineMetrics]);
const draftReport = useMemo(() => buildReport(state.draft, draftMetrics), [state.draft, draftMetrics]);
const impacts = useMemo(() => compareSnapshots(state.baseline, state.draft), [state.baseline, state.draft]);

useEffect(() => {
  try {
    saveProject({ schemaVersion: 1, baseline: state.baseline, draft: state.draft, updatedAt: new Date().toISOString() });
    setStorageWarning("");
  } catch {
    setStorageWarning("本地草稿保存失败，当前页面内仍可继续编辑和导出");
  }
}, [state.baseline, state.draft]);

return (
  <main>
    <h1>销售数据修改影响报告</h1>
    <FileImport onImport={(data) => dispatch({ type: "import", data })} onError={setImportError} />
    <Toolbar
      onApply={() => dispatch({ type: "apply" })}
      onRevert={() => dispatch({ type: "revert" })}
      onClear={() => setClearDialogOpen(true)}
    />
    <StatusMessage error={importError} notice={storageWarning} />
    <ConfirmClearDialog open={clearDialogOpen} onCancel={() => setClearDialogOpen(false)} onConfirm={() => { dispatch({ type: "clear" }); setClearDialogOpen(false); }} />
    <div className="workspace">
      <SalesTable data={state.draft} sourceCells={state.sourceCells} onEdit={(regionId, value) => dispatch({ type: "edit", regionId, value })} />
      <ImpactList impacts={impacts} selectedImpactId={state.selectedImpactId} onSelect={(impact) => dispatch({ type: "selectImpact", id: impact.id, sourceCells: impact.sourceCells })} />
      <ReportPreview baselineReport={baselineReport} draftReport={draftReport} sourceCells={state.sourceCells} />
    </div>
  </main>
);
```

Replace the initializer with a function that first calls `loadProject`; valid snapshots restore baseline/draft, while absent/malformed snapshots call `initialProjectState(salesDemo)`. Convert storage read exceptions into the same non-blocking warning. Keep `FileImport` errors separate from storage warnings in the final UI.

Each impact button has `aria-label={`查看${impact.label}来源`}` and displays `${impact.before} → ${impact.after}`. Report blocks use `source-report` when their `sourceCells` intersect the selected evidence. `FileImport` calls `readSalesFile` and reports the error message without replacing state.

- [ ] **Step 4: Verify the UI test and typecheck**

Run: `npx vitest run tests/ui/App.test.tsx --environment jsdom && npm run typecheck`  
Expected: canonical interaction passes and TypeScript reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components src/styles.css tests/ui
git commit -m "feat: add interactive three-panel impact preview"
```

### Task 7: Excel and Word Export

**Files:**
- Create: `src/adapters/docx/createWordReport.ts`, `src/adapters/xlsx/downloadWorkbook.ts`
- Modify: `src/App.tsx`, `src/components/Toolbar.tsx`
- Test: `tests/adapters/createWordReport.test.ts`

**Interfaces:**
- Produces: `createWordReport(data: SalesData, report: ReportModel): Promise<Blob>`, `downloadSalesWorkbook(data: SalesData): void`.
- Both exports consume current `baseline`; the toolbar warns when draft differs from baseline.

- [ ] **Step 1: Write a failing Word generation test**

```ts
import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { computeMetrics } from "../../src/core/metrics";
import { buildReport } from "../../src/core/report";
import { createWordReport } from "../../src/adapters/docx/createWordReport";

describe("createWordReport", () => {
  it("creates a non-empty Word blob from the confirmed report", async () => {
    const blob = await createWordReport(salesDemo, buildReport(salesDemo, computeMetrics(salesDemo)));
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("wordprocessingml");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/adapters/createWordReport.test.ts`  
Expected: FAIL because `createWordReport` is missing.

- [ ] **Step 3: Implement Word and browser downloads**

`src/adapters/docx/createWordReport.ts`:

```ts
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import type { ReportModel, SalesData } from "../../core/types";

export async function createWordReport(data: SalesData, report: ReportModel): Promise<Blob> {
  const children = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `生成时间：${new Date().toISOString()}` }),
    ...report.blocks.map((block) => new Paragraph({ text: block.text })),
    new Paragraph({ text: "数据来源" }),
    ...data.regions.map((region) => new Paragraph({ text: `${region.name}：previous=${region.previousCell}，current=${region.currentCell}` })),
  ];
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
```

`downloadSalesWorkbook` calls `XLSX.writeFile(createSalesWorkbook(data), "what-if-report-confirmed.xlsx")`. Word download uses this helper with filename `what-if-report-confirmed.docx`:

```ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

`App` blocks neither export nor editing on errors and displays `导出已确认版本，不包含未应用草稿` when impacts exist.

- [ ] **Step 4: Verify Word generation and full unit suite**

Run: `npx vitest run tests/adapters/createWordReport.test.ts && npm test`  
Expected: Word test and all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/docx src/adapters/xlsx/downloadWorkbook.ts src/App.tsx src/components/Toolbar.tsx tests/adapters/createWordReport.test.ts
git commit -m "feat: export confirmed Excel and Word reports"
```

### Task 8: End-to-End Workflow, Validation UX and Accessibility

**Files:**
- Create: `playwright.config.ts`, `e2e/project.spec.ts`
- Modify: `src/components/StatusMessage.tsx`, `src/styles.css`
- Modify: `README.md`

**Interfaces:**
- Uses the public sample at `/templates/sales-demo.xlsx` and the accessible controls from Task 6.

- [ ] **Step 1: Write the browser test before final integration**

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:5173", viewport: { width: 1280, height: 800 } },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

`e2e/project.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

const east = (page: import("@playwright/test").Page) => page.getByLabel("华东当前销售额");

test("import, preview, apply and export", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("input[type=file]", "public/templates/sales-demo.xlsx");
  await east(page).fill("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
  await expect(page.getByText("20.00% → 8.00%")).toBeVisible();
  await expect(page.getByText("华东 → 华西")).toBeVisible();
  await page.getByRole("button", { name: "应用修改" }).click();
  const [excel] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出 Excel" }).click()]);
  expect(excel.suggestedFilename()).toBe("what-if-report-confirmed.xlsx");
  const [word] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出 Word" }).click()]);
  expect(word.suggestedFilename()).toBe("what-if-report-confirmed.docx");
});

test("restore and clear a local draft", async ({ page }) => {
  await page.goto("/");
  await east(page).fill("90");
  await page.reload();
  await expect(east(page)).toHaveValue("90");
  await page.getByRole("button", { name: "清除本地项目" }).click();
  await page.getByRole("button", { name: "确认清除" }).click();
  await expect(east(page)).toHaveValue("120");
});

test("invalid workbook preserves current data", async ({ page }) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["region"]]), "Other");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await page.goto("/");
  await page.setInputFiles("input[type=file]", { name: "invalid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await expect(page.getByRole("alert")).toContainText("缺少 Sales 工作表");
  await expect(east(page)).toHaveValue("120");
});

test("mobile layout and keyboard controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await east(page).focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
  await page.getByRole("button", { name: "应用修改" }).focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
```

The clear-project control opens an accessible dialog with a real `确认清除` button instead of relying on `window.confirm`, so the browser test and keyboard flow use the same implementation.

- [ ] **Step 2: Run Playwright and observe integration failures**

Run: `npx playwright install chromium && npm run test:e2e`  
Expected: at least one failure before final integration; record the actual missing behavior rather than weakening assertions.

- [ ] **Step 3: Fix integration and accessibility issues**

Use `role="alert"` for import/export errors and `role="status"` for non-blocking notices. Focus remains on the edited input after re-render. Buttons have disabled states only when their action is invalid, and clear-project confirmation is keyboard accessible. Mobile layout is one column with no required horizontal page scrolling.

- [ ] **Step 4: Re-run the full browser suite**

Run: `npm run test:e2e`  
Expected: all Playwright tests pass in Chromium.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e src/components/StatusMessage.tsx src/styles.css README.md
git commit -m "test: verify complete local-first user workflow"
```

### Task 9: CI, Release Documentation and Final Verification

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Modify: `README.md`, `ROADMAP.md`, `CHANGELOG.md`, `CONTRIBUTING.md`

**Interfaces:**
- CI runs on pull requests and pushes to `main`; deployment runs only after a successful `main` workflow.

- [ ] **Step 1: Add the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - run: npm run build
```

`deploy.yml` runs only after CI succeeds on `main`:

```yaml
name: deploy
on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci && npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
        id: deployment
```

The workflow contains no secrets or uploaded user files. Enable Pages only after the user approves external publication.

- [ ] **Step 2: Update release-facing documentation**

README changes status from planning to implemented only after local checks pass. It includes the static demo URL once deployment exists, a feature/limitation table, privacy statement, local commands, screenshot or GIF, and links to the spec and roadmap. CHANGELOG lists only behavior verified in this release. ROADMAP marks v0.1.0 complete and leaves later versions uncompleted.

- [ ] **Step 3: Run local release verification**

Run in order:

```bash
npm ci
npm run example:generate
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Expected: every command exits 0, `dist/` contains the static app, and both template files exist.

- [ ] **Step 4: Manually verify release artifacts**

Open the production preview with `npm run preview -- --host 127.0.0.1`, complete the canonical import/edit/apply/export flow, and open both exported files in WPS. Verify the report values match the confirmed workbook and no network request carries file content.

- [ ] **Step 5: Commit**

```bash
git add .github README.md ROADMAP.md CHANGELOG.md CONTRIBUTING.md
git commit -m "docs: prepare v0.1.0 open-source release"
```

## Self-Review Notes for Executors

- If a test fails because the plan's expected behavior is wrong for the confirmed spec, update the plan and spec together before changing the assertion.
- Do not silence errors, reduce coverage, accept formulas, or add a backend to make the flow easier.
- Do not publish a public repository, enable Pages, create a release or share a demo URL until the user explicitly approves that external action.
