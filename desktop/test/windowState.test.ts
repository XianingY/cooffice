import { describe, expect, it } from "vitest";
import { MIN_HEIGHT, MIN_WIDTH, normaliseBounds } from "../src/main/windowState.js";

const laptop = [{ x: 0, y: 0, width: 1440, height: 900 }];
const external = [
  { x: 0, y: 0, width: 1440, height: 900 },
  { x: 1440, y: -200, width: 2560, height: 1440 },
];

describe("window bounds", () => {
  it("falls back to the default size for junk input", () => {
    const bounds = normaliseBounds(null, laptop);
    expect(bounds.width).toBe(1280);
    expect(bounds.height).toBe(860);
    expect(bounds.x).toBe(Math.round((1440 - 1280) / 2));
  });

  it("never restores a window below the usable minimum", () => {
    const bounds = normaliseBounds({ width: 200, height: 100, x: 10, y: 10 }, laptop);
    expect(bounds.width).toBe(MIN_WIDTH);
    expect(bounds.height).toBe(MIN_HEIGHT);
  });

  it("keeps a position that is still on a connected display", () => {
    const bounds = normaliseBounds({ width: 1200, height: 800, x: 1600, y: -100 }, external);
    expect(bounds).toMatchObject({ x: 1600, y: -100, width: 1200, height: 800 });
  });

  it("re-centres a window whose monitor was unplugged", () => {
    const bounds = normaliseBounds({ width: 1200, height: 800, x: 4000, y: 2000 }, laptop);
    expect(bounds.x).toBe(Math.round((1440 - 1200) / 2));
    expect(bounds.y).toBe(Math.round((900 - 800) / 2));
  });

  it("preserves the maximized flag", () => {
    expect(normaliseBounds({ width: 1200, height: 800, maximized: true }, laptop).maximized).toBe(true);
  });

  it("tolerates an empty display list", () => {
    expect(normaliseBounds({ width: 1000, height: 700 }, [])).toEqual({
      width: 1000,
      height: 700,
      maximized: false,
    });
  });
});
