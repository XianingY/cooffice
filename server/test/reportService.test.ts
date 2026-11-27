import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { AuditRepository } from "../src/modules/audit/auditRepository.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";
import { ProjectRepository } from "../src/modules/projects/projectRepository.js";
import { ProjectService } from "../src/modules/projects/projectService.js";
import { ReportService, buildChart, buildReport, computeMetrics } from "../src/modules/reports/reportService.js";

const data = {
  regions: [
    { id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" },
    { id: "region-2", name: "华西", previous: 90, current: 100, previousCell: "B3", currentCell: "C3" },
  ],
};
const config = { blocks: ["summary" as const, "growthNarrative" as const, "leaderNarrative" as const] };

describe("report calculations", () => {
  it("computes metrics with growth and leader", () => {
    expect(computeMetrics(data)).toEqual({ totalCurrent: 220, totalPrevious: 190, growthRate: 30 / 190, topRegionId: "region-1" });
  });

  it("builds report blocks in configured order, deduplicates blocks and rounds float noise", () => {
    const blocks = buildReport(data, { blocks: ["leaderNarrative", "summary", "summary"] });
    expect(blocks.map((block) => block.id)).toEqual(["leaderNarrative", "summary"]);
    expect(blocks[0].text).toBe("华东销售额最高。");

    const decimalData = {
      regions: [
        { id: "region-1", name: "华东", previous: 0.1, current: 0.1, previousCell: "B2", currentCell: "C2" },
        { id: "region-2", name: "华西", previous: 0.2, current: 0.2, previousCell: "B3", currentCell: "C3" },
      ],
    };
    expect(buildReport(decimalData, { blocks: ["summary"] })[0].text).toBe("当前总销售额为 0.3 万元。");
  });

  it("builds chart data and handles zero previous total", () => {
    expect(buildChart(data).data[0]).toEqual({ regionId: "region-1", name: "华东", value: 120 });
    expect(computeMetrics({ regions: [{ ...data.regions[0], previous: 0, current: 0 }] }).growthRate).toBeNull();
  });
});

describe("ReportService", () => {
  it("generates from baseline by default and draft on request", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const user = new UserRepository(db).create({ email: "a@b.test", passwordHash: "h", displayName: "A" });
      const service = new ProjectService(new ProjectRepository(db), new AuditRepository(db));
      const project = service.create(user.id, { name: "P", baseline: data }, "r1");
      const edited = structuredClone(data);
      edited.regions[0].current = 90;
      service.editDraft(user.id, project.id, edited, "r2");
      const reports = new ReportService(service);

      const baseline = reports.generate(user.id, project.id, false);
      expect(baseline.basis).toBe("baseline");
      expect(baseline.metrics.totalCurrent).toBe(220);
      const draft = reports.generate(user.id, project.id, true);
      expect(draft.basis).toBe("draft");
      expect(draft.metrics.totalCurrent).toBe(190);
      expect(reports.analytics(user.id, project.id).hasUnappliedChanges).toBe(true);
    } finally { db.close(); }
  });
});
