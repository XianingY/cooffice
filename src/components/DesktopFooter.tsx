import { useEffect, useState } from "react";
import { getDesktop, type AppInfo } from "../desktop/bridge";

/**
 * Desktop-only footer strip: version, plus one-click access to where the app
 * keeps its data and logs. Renders nothing in the browser build.
 */
export function DesktopFooter() {
  const bridge = getDesktop();
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!bridge) return undefined;
    let active = true;
    void bridge
      .appInfo()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [bridge]);

  if (!bridge) return null;

  return (
    <span className="desktop-footer">
      <span className="desktop-badge">桌面版{info ? ` v${info.version}` : ""}</span>
      <button type="button" className="link-button" onClick={() => void bridge.openDataDir()}>
        数据目录
      </button>
      <button type="button" className="link-button" onClick={() => void bridge.openLogsDir()}>
        日志目录
      </button>
    </span>
  );
}
