import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import { buildMenuTemplate, type MenuContext } from "../src/main/menu.js";

function context(overrides: Partial<MenuContext> = {}): MenuContext {
  return {
    appName: "What-if Report",
    isMac: true,
    isDev: false,
    recentFiles: [],
    theme: "system",
    onAction: vi.fn(),
    onTheme: vi.fn(),
    onOpenRecent: vi.fn(),
    onClearRecent: vi.fn(),
    onCheckForUpdates: vi.fn(),
    onOpenDataDir: vi.fn(),
    onOpenLogsDir: vi.fn(),
    onShowShortcuts: vi.fn(),
    ...overrides,
  };
}

function submenuOf(
  template: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] {
  const found = template.find((item) => item.label === label);
  if (!found) throw new Error(`menu ${label} not found`);
  return found.submenu as MenuItemConstructorOptions[];
}

function acceleratorOf(items: MenuItemConstructorOptions[], label: string): string | undefined {
  return items.find((item) => item.label === label)?.accelerator as string | undefined;
}

describe("application menu", () => {
  it("gives macOS the standard app menu", () => {
    const template = buildMenuTemplate(context());
    const roles = (template[0].submenu as MenuItemConstructorOptions[]).map((item) => item.role);
    expect(template[0].label).toBe("What-if Report");
    expect(roles).toEqual(expect.arrayContaining(["about", "services", "hide", "quit"]));
  });

  it("omits the app menu on other platforms", () => {
    const template = buildMenuTemplate(context({ isMac: false }));
    expect(template[0].label).toBe("文件");
  });

  it("keeps native editing roles so ⌘C/⌘V work in inputs", () => {
    const editMenu = submenuOf(buildMenuTemplate(context()), "编辑");
    expect(editMenu.map((item) => item.role)).toEqual(
      expect.arrayContaining(["undo", "cut", "copy", "paste", "selectAll"]),
    );
  });

  it("binds the document shortcuts once and only once", () => {
    const fileMenu = submenuOf(buildMenuTemplate(context()), "文件");
    expect(acceleratorOf(fileMenu, "打开项目文件…")).toBe("CmdOrCtrl+O");
    expect(acceleratorOf(fileMenu, "保存项目文件…")).toBe("CmdOrCtrl+S");
    expect(acceleratorOf(fileMenu, "导入 Excel 或 CSV…")).toBe("CmdOrCtrl+I");
    expect(acceleratorOf(fileMenu, "导出 Excel…")).toBe("CmdOrCtrl+E");
    expect(acceleratorOf(fileMenu, "导出 Word…")).toBe("CmdOrCtrl+Shift+E");

    const accelerators = JSON.stringify(buildMenuTemplate(context())).match(/"CmdOrCtrl\+[^"]+"/g) ?? [];
    expect(new Set(accelerators).size).toBe(accelerators.length);
  });

  it("routes file commands through the renderer action callback", () => {
    const ctx = context();
    const fileMenu = submenuOf(buildMenuTemplate(ctx), "文件");
    const open = fileMenu.find((item) => item.label === "打开项目文件…");
    (open?.click as () => void)();
    expect(ctx.onAction).toHaveBeenCalledWith("open-project");
  });

  it("lists recent files and can clear them", () => {
    const ctx = context({ recentFiles: ["/tmp/a.json", "/tmp/b.json"] });
    const fileMenu = submenuOf(buildMenuTemplate(ctx), "文件");
    const recent = fileMenu.find((item) => item.label === "最近打开");
    const items = recent?.submenu as MenuItemConstructorOptions[];

    expect(items[0].label).toBe("/tmp/a.json");
    (items[1].click as () => void)();
    expect(ctx.onOpenRecent).toHaveBeenCalledWith("/tmp/b.json");

    const clear = items[items.length - 1];
    (clear.click as () => void)();
    expect(ctx.onClearRecent).toHaveBeenCalled();
  });

  it("shows a disabled placeholder when there is no history", () => {
    const fileMenu = submenuOf(buildMenuTemplate(context()), "文件");
    const items = fileMenu.find((item) => item.label === "最近打开")?.submenu as MenuItemConstructorOptions[];
    expect(items).toHaveLength(1);
    expect(items[0].enabled).toBe(false);
  });

  it("only exposes devtools for development builds", () => {
    expect(JSON.stringify(buildMenuTemplate(context()))).not.toContain("toggleDevTools");
    expect(JSON.stringify(buildMenuTemplate(context({ isDev: true })))).toContain("toggleDevTools");
  });

  it("marks the active theme with a radio group under View", () => {
    const ctx = context({ theme: "dark" });
    const view = submenuOf(buildMenuTemplate(ctx), "视图");
    const appearance = view.find((item) => item.label === "外观");
    const items = appearance?.submenu as MenuItemConstructorOptions[];

    expect(items.map((item) => item.label)).toEqual(["跟随系统", "浅色", "深色"]);
    expect(items.map((item) => item.checked)).toEqual([false, false, true]);
    expect(items.every((item) => item.type === "radio")).toBe(true);

    (items[1].click as () => void)();
    expect(ctx.onTheme).toHaveBeenCalledWith("light");
  });

  it("offers help and update entry points", () => {
    const ctx = context();
    const help = submenuOf(buildMenuTemplate(ctx), "帮助");
    (help.find((item) => item.label === "键盘快捷键")?.click as () => void)();
    expect(ctx.onShowShortcuts).toHaveBeenCalled();

    const appMenu = buildMenuTemplate(ctx)[0].submenu as MenuItemConstructorOptions[];
    (appMenu.find((item) => item.label === "检查更新…")?.click as () => void)();
    expect(ctx.onCheckForUpdates).toHaveBeenCalled();
  });
});
