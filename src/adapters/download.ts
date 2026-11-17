/**
 * Browser download helper for generated Blobs.
 *
 * Kept free of format libraries so that saving JSON or Word output never drags
 * SheetJS into the bundle.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
