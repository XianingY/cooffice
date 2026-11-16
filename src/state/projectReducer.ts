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
  | { type: "importDocument"; baseline: SalesData; draft: SalesData }
  | { type: "edit"; regionId: string; value: number }
  | { type: "apply" }
  | { type: "revert" }
  | { type: "selectImpact"; id: ImpactId | null; sourceCells: string[] }
  | { type: "clear" };

/** Two independent deep copies: editing the draft can never touch baseline. */
export function initialProjectState(data: SalesData): ProjectState {
  return {
    baseline: structuredClone(data),
    draft: structuredClone(data),
    selectedImpactId: null,
    sourceCells: [],
  };
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  if (action.type === "clear") return initialProjectState(salesDemo);
  if (action.type === "import") return initialProjectState(action.data);
  if (action.type === "importDocument") {
    return {
      baseline: structuredClone(action.baseline),
      draft: structuredClone(action.draft),
      selectedImpactId: null,
      sourceCells: [],
    };
  }
  if (action.type === "apply") return initialProjectState(state.draft);
  if (action.type === "revert") {
    return { ...state, draft: structuredClone(state.baseline), selectedImpactId: null, sourceCells: [] };
  }
  if (action.type === "selectImpact") {
    return { ...state, selectedImpactId: action.id, sourceCells: action.sourceCells };
  }

  if (!Number.isFinite(action.value) || action.value < 0) return state;
  const draft = structuredClone(state.draft);
  const region = draft.regions.find((item) => item.id === action.regionId);
  if (!region) return state;
  region.current = action.value;
  return { ...state, draft, selectedImpactId: null, sourceCells: [] };
}
