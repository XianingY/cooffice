/// <reference types="vite/client" />

// Desktop shell bridge injected by the Electron preload (see src/desktop/bridge.ts).
interface Window {
  desktop?: import("./desktop/bridge").DesktopBridge;
}
