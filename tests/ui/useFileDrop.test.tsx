import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopBridge } from "../../src/desktop/bridge";
import { useFileDrop } from "../../src/hooks/useFileDrop";

function Probe({ onFile, onError }: { onFile(file: File): void; onError(message: string): void }) {
  const dragging = useFileDrop({ onFile, onError });
  return <div data-testid="drop-state">{dragging ? "dragging" : "idle"}</div>;
}

function fileTransfer(file: File): DataTransfer {
  return { types: ["Files"], files: [file], dropEffect: "none" } as unknown as DataTransfer;
}

afterEach(() => {
  delete (window as { desktop?: unknown }).desktop;
});

describe("file drop", () => {
  it("offers feedback while files hover and clears it after the drop", () => {
    const onFile = vi.fn();
    render(<Probe onFile={onFile} onError={vi.fn()} />);
    const transfer = fileTransfer(new File(["x"], "data.csv"));

    fireEvent.dragEnter(window, { dataTransfer: transfer });
    expect(screen.getByTestId("drop-state")).toHaveTextContent("dragging");
    fireEvent.dragOver(window, { dataTransfer: transfer });
    fireEvent.dragLeave(window, { dataTransfer: transfer });
    expect(screen.getByTestId("drop-state")).toHaveTextContent("idle");

    fireEvent.dragEnter(window, { dataTransfer: transfer });
    fireEvent.drop(window, { dataTransfer: transfer });
    expect(screen.getByTestId("drop-state")).toHaveTextContent("idle");
    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile.mock.calls[0][0].name).toBe("data.csv");
  });

  it("ignores drags that do not carry files", () => {
    const onFile = vi.fn();
    render(<Probe onFile={onFile} onError={vi.fn()} />);
    const transfer = { types: ["text/plain"], files: [] } as unknown as DataTransfer;
    fireEvent.dragEnter(window, { dataTransfer: transfer });
    fireEvent.drop(window, { dataTransfer: transfer });
    expect(screen.getByTestId("drop-state")).toHaveTextContent("idle");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("reads a native path through the desktop bridge", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const openDroppedFile = vi.fn().mockResolvedValue({
      kind: "spreadsheet",
      canceled: false,
      name: "native.csv",
      bytes,
    });
    (window as { desktop?: DesktopBridge }).desktop = {
      isDesktop: true,
      openDroppedFile,
    } as unknown as DesktopBridge;

    const onFile = vi.fn();
    render(<Probe onFile={onFile} onError={vi.fn()} />);
    const file = new File(["x"], "native.csv");
    Object.defineProperty(file, "path", { value: "/tmp/native.csv" });
    fireEvent.drop(window, { dataTransfer: fileTransfer(file) });

    await vi.waitFor(() => expect(openDroppedFile).toHaveBeenCalledWith("/tmp/native.csv"));
    expect(onFile.mock.calls[0][0].name).toBe("native.csv");
    expect((onFile.mock.calls[0][0] as File).size).toBe(3);
  });

  it("surfaces a rejected drop instead of importing it", async () => {
    (window as { desktop?: DesktopBridge }).desktop = {
      isDesktop: true,
      openDroppedFile: vi.fn().mockResolvedValue({
        kind: "unsupported",
        canceled: true,
        error: "只支持表格和项目文件",
      }),
    } as unknown as DesktopBridge;

    const onFile = vi.fn();
    const onError = vi.fn();
    render(<Probe onFile={onFile} onError={onError} />);
    const file = new File(["x"], "notes.txt");
    Object.defineProperty(file, "path", { value: "/tmp/notes.txt" });
    fireEvent.drop(window, { dataTransfer: fileTransfer(file) });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("只支持表格和项目文件"));
    expect(onFile).not.toHaveBeenCalled();
  });

  it("prefers webUtils.getPathForFile over removed File.path on Electron 32+", async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const openDroppedFile = vi.fn().mockResolvedValue({
      kind: "project",
      canceled: false,
      filePath: "/Users/test/demo.whatif",
      name: "demo.whatif",
      bytes,
    });
    const getPathForFile = vi.fn().mockReturnValue("/Users/test/demo.whatif");
    (window as { desktop?: DesktopBridge }).desktop = {
      isDesktop: true,
      getPathForFile,
      openDroppedFile,
    } as unknown as DesktopBridge;

    const onFile = vi.fn();
    render(<Probe onFile={onFile} onError={vi.fn()} />);
    const file = new File(["{}"], "demo.whatif");
    fireEvent.drop(window, { dataTransfer: fileTransfer(file) });

    await vi.waitFor(() => expect(openDroppedFile).toHaveBeenCalledWith("/Users/test/demo.whatif"));
    expect(getPathForFile).toHaveBeenCalledWith(file);
    expect(onFile).toHaveBeenCalledWith(expect.any(File), "/Users/test/demo.whatif");
  });
});
