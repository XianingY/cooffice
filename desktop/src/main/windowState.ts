import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

export const DEFAULT_BOUNDS: WindowBounds = { width: 1280, height: 860 };
export const MIN_WIDTH = 960;
export const MIN_HEIGHT = 640;

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Keep a restored window usable: a monitor may have been unplugged since the
 * last run, so bounds that no longer intersect any display are re-centred and
 * sizes are clamped to the supported range.
 */
export function normaliseBounds(input: unknown, displays: Rect[]): WindowBounds {
  const raw = (input ?? {}) as Partial<WindowBounds>;
  const width = Math.max(MIN_WIDTH, Math.round(finite(raw.width) ?? DEFAULT_BOUNDS.width));
  const height = Math.max(MIN_HEIGHT, Math.round(finite(raw.height) ?? DEFAULT_BOUNDS.height));
  const x = finite(raw.x);
  const y = finite(raw.y);
  const maximized = raw.maximized === true;

  if (displays.length === 0) return { width, height, maximized };

  // A window is only worth restoring if a meaningful part of its title bar is
  // still on a visible display.
  if (x !== undefined && y !== undefined) {
    const visible = displays.some((display) => {
      const overlapX = Math.min(x + width, display.x + display.width) - Math.max(x, display.x);
      const overlapY = Math.min(y + height, display.y + display.height) - Math.max(y, display.y);
      return overlapX >= 120 && overlapY >= 60;
    });
    if (visible) return { width, height, x: Math.round(x), y: Math.round(y), maximized };
  }

  const primary = displays[0];
  const centredX = Math.round(primary.x + (primary.width - width) / 2);
  const centredY = Math.round(primary.y + (primary.height - height) / 2);
  return { width, height, x: centredX, y: centredY, maximized };
}

export function loadWindowState(file: string, displays: Rect[]): WindowBounds {
  try {
    return normaliseBounds(JSON.parse(readFileSync(file, "utf8")), displays);
  } catch {
    return normaliseBounds(null, displays);
  }
}

export function saveWindowState(file: string, bounds: WindowBounds): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(bounds), "utf8");
  } catch {
    // Persisting the window frame must never break shutdown.
  }
}
