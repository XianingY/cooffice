import type { MenuItemConstructorOptions } from "electron";
import type { MenuAction } from "../shared/contract.js";

export interface MenuContext {
  appName: string;
  isMac: boolean;
  isDev: boolean;
  recentFiles: string[];
  onAction(action: MenuAction): void;
  onOpenRecent(filePath: string): void;
  onClearRecent(): void;
  onCheckForUpdates(): void;
  onOpenDataDir(): void;
  onOpenLogsDir(): void;
  onShowShortcuts(): void;
}

/**
 * Application menu.
 *
 * Built as a plain object so the shape can be asserted in tests without an
 * Electron runtime. Roles (undo/copy/…​) are delegated to the OS so that text
 * fields keep native keyboard behaviour — a wrapped web page usually loses
 * ⌘C/⌘V on macOS without them.
 */
export function buildMenuTemplate(ctx: MenuContext): MenuItemConstructorOptions[] {
  const recentSubmenu: MenuItemConstructorOptions[] =
    ctx.recentFiles.length > 0
      ? [
          ...ctx.recentFiles.map<MenuItemConstructorOptions>((filePath) => ({
            label: filePath,
            click: () => ctx.onOpenRecent(filePath),
          })),
          { type: "separator" },
          { label: "清除最近打开", click: () => ctx.onClearRecent() },
        ]
      : [{ label: "暂无最近打开的项目", enabled: false }];

  const appMenu: MenuItemConstructorOptions[] = ctx.isMac
    ? [
        {
          label: ctx.appName,
          submenu: [
            { role: "about", label: `关于 ${ctx.appName}` },
            { label: "检查更新…", click: () => ctx.onCheckForUpdates() },
            { type: "separator" },
            { label: "打开数据目录", click: () => ctx.onOpenDataDir() },
            { label: "打开日志目录", click: () => ctx.onOpenLogsDir() },
            { type: "separator" },
            { role: "services", label: "服务" },
            { type: "separator" },
            { role: "hide", label: `隐藏 ${ctx.appName}` },
            { role: "hideOthers", label: "隐藏其他" },
            { role: "unhide", label: "显示全部" },
            { type: "separator" },
            { role: "quit", label: `退出 ${ctx.appName}` },
          ],
        },
      ]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: "文件",
    submenu: [
      { label: "打开项目文件…", accelerator: "CmdOrCtrl+O", click: () => ctx.onAction("open-project") },
      { label: "最近打开", submenu: recentSubmenu },
      { type: "separator" },
      { label: "保存项目文件…", accelerator: "CmdOrCtrl+S", click: () => ctx.onAction("save-project") },
      { type: "separator" },
      { label: "导入 Excel 或 CSV…", accelerator: "CmdOrCtrl+I", click: () => ctx.onAction("import-spreadsheet") },
      { label: "导出 Excel…", accelerator: "CmdOrCtrl+E", click: () => ctx.onAction("export-excel") },
      { label: "导出 Word…", accelerator: "CmdOrCtrl+Shift+E", click: () => ctx.onAction("export-word") },
      { type: "separator" },
      { label: "清除本地项目", click: () => ctx.onAction("clear-project") },
      ...(ctx.isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const, label: "退出" }]),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    role: "help",
    label: "帮助",
    submenu: [
      { label: "键盘快捷键", click: () => ctx.onShowShortcuts() },
      { label: "打开日志目录", click: () => ctx.onOpenLogsDir() },
      ...(ctx.isMac
        ? []
        : [{ type: "separator" as const }, { label: "检查更新…", click: () => ctx.onCheckForUpdates() }]),
    ],
  };

  return [
    ...appMenu,
    fileMenu,
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新载入" },
        { role: "forceReload", label: "强制重新载入" },
        ...(ctx.isDev ? [{ role: "toggleDevTools" as const, label: "开发者工具" }] : []),
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
      ],
    },
    {
      label: "窗口",
      role: "windowMenu",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(ctx.isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const, label: "前置全部窗口" },
            ]
          : [{ role: "close" as const, label: "关闭" }]),
      ],
    },
    helpMenu,
  ];
}
