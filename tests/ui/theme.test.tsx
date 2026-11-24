import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../../src/components/Toolbar";
import { initTheme, normaliseTheme, resolveTheme, setTheme } from "../../src/theme";

describe("theme resolution", () => {
  it("only accepts known settings", () => {
    expect(normaliseTheme("dark")).toBe("dark");
    expect(normaliseTheme("midnight")).toBe("system");
  });

  it("defers to the system only for the system setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("browser theme controller", () => {
  it("applies a light palette when there is no stored preference", () => {
    const teardown = initTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    teardown();
  });

  it("stores a manual choice and repaints immediately", async () => {
    const teardown = initTheme();
    const state = await setTheme("dark");
    expect(state).toEqual({ setting: "dark", resolved: "dark" });
    expect(localStorage.getItem("whatif.theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    teardown();
  });

  it("restores a stored choice on the next mount", () => {
    localStorage.setItem("whatif.theme", "dark");
    const teardown = initTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
    teardown();
  });
});

describe("theme toolbar control", () => {
  it("shows the active setting and forwards a cycle request", async () => {
    const user = userEvent.setup();
    const onCycleTheme = vi.fn();
    render(
      <Toolbar
        hasUnappliedDraft={false}
        onApply={vi.fn()}
        onRevert={vi.fn()}
        onClear={vi.fn()}
        theme="dark"
        onCycleTheme={onCycleTheme}
      />,
    );
    const button = screen.getByRole("button", { name: "切换主题" });
    expect(button).toHaveTextContent("主题：深色");
    await user.click(button);
    expect(onCycleTheme).toHaveBeenCalledOnce();
  });
});
