import type { SalesData } from "../core/types";

/** Canonical fictional example from the confirmed design spec (section 4.1). */
export const salesDemo: SalesData = {
  regions: [
    { id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" },
    { id: "region-2", name: "华西", previous: 90, current: 100, previousCell: "B3", currentCell: "C3" },
    { id: "region-3", name: "华北", previous: 60, current: 80, previousCell: "B4", currentCell: "C4" },
  ],
};
