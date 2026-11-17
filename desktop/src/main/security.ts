import { session } from "electron";

/**
 * Renderer hardening.
 *
 * The window shows first-party content only, so every capability the page does
 * not use is denied outright: no camera, microphone, geolocation, clipboard
 * reads or screen capture. Permission checks return false as well so that even
 * code paths that only *query* a permission get a consistent answer.
 */
export function hardenSessionPermissions(): void {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);
}
