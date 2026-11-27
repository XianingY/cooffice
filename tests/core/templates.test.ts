import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../../src/core/impacts";
import {
  applyScenarioPreset,
  DEFAULT_TEMPLATE_ID,
  getScenarioTemplate,
  SCENARIO_TEMPLATES,
} from "../../src/core/templates";
import { validateSalesData } from "../../src/core/validation";

describe("scenario templates", () => {
  it("registers valid templates with unique ids and impactful presets", () => {
    const ids = new Set<string>();
    for (const template of SCENARIO_TEMPLATES) {
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);
      expect(() => validateSalesData(template.data)).not.toThrow();
      expect(template.presets.length).toBeGreaterThan(0);

      for (const preset of template.presets) {
        const draft = applyScenarioPreset(template.data, preset);
        expect(compareSnapshots(template.data, draft).length).toBeGreaterThan(0);
      }
    }
    expect(getScenarioTemplate(DEFAULT_TEMPLATE_ID).id).toBe("sales");
    expect(getScenarioTemplate("unknown-template").id).toBe("sales");
  });

  it("applies presets immutably and ignores invalid edits", () => {
    const template = getScenarioTemplate("sales");
    const snapshot = structuredClone(template.data);
    const updated = applyScenarioPreset(template.data, {
      id: "test",
      label: "test",
      description: "test",
      edits: [
        { regionId: "region-1", current: 90 },
        { regionId: "region-2", current: -5 },
        { regionId: "missing", current: 999 },
      ],
    });

    expect(template.data).toEqual(snapshot);
    expect(updated.regions[0].current).toBe(90);
    expect(updated.regions[1].current).toBe(snapshot.regions[1].current);
  });
});
