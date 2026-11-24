import { useEffect, useRef, useState } from "react";
import { filePathOf, getDesktop, toFile } from "../desktop/bridge";

export interface FileDropHandlers {
  /** A browser File or a desktop payload rebuilt as a File. */
  onFile(file: File): void;
  onError(message: string): void;
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Window-level drag/drop import.
 *
 * In a tab the dropped File is handed straight to the shared importer. In the
 * Electron shell the path is passed to the main process, which reuses the same
 * extension/size checks as the native open dialog; the renderer never gets a
 * general-purpose read API.
 */
export function useFileDrop(handlers: FileDropHandlers): boolean {
  const [dragging, setDragging] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let depth = 0;

    const ingest = async (file: File) => {
      const bridge = getDesktop();
      const path = bridge ? filePathOf(file) : null;
      if (bridge && path) {
        try {
          const result = await bridge.openDroppedFile(path);
          if (result.error || !result.bytes || !result.name) {
            handlersRef.current.onError(result.error ?? "无法读取拖入的文件");
            return;
          }
          handlersRef.current.onFile(toFile(result.name, result.bytes));
        } catch (error) {
          handlersRef.current.onError(error instanceof Error ? error.message : "文件读取失败");
        }
        return;
      }
      handlersRef.current.onFile(file);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void ingest(file);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return dragging;
}
