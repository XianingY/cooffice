import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { createWordReport } from "../../src/adapters/docx/createWordReport";
import { downloadBlob, downloadSalesWorkbook } from "../../src/adapters/xlsx/downloadWorkbook";

vi.mock("../../src/adapters/docx/createWordReport", () => ({ createWordReport: vi.fn() }));
vi.mock("../../src/adapters/xlsx/downloadWorkbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/xlsx/downloadWorkbook")>();
  return { ...actual, downloadSalesWorkbook: vi.fn(), downloadBlob: vi.fn() };
});

const confirmedEast = expect.objectContaining({ name: "华东", current: 120 });

describe("export uses the confirmed baseline", () => {
  it("warns about the pending draft and exports baseline for both formats", async () => {
    vi.mocked(createWordReport).mockResolvedValue(new Blob(["docx"]));
    const user = userEvent.setup();
    render(<App />);

    const east = screen.getByLabelText("华东当前销售额");
    await user.clear(east);
    await user.type(east, "90");
    expect(screen.getByText("导出已确认版本，不包含未应用草稿")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "导出 Excel" }));
    expect(downloadSalesWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({ regions: expect.arrayContaining([confirmedEast]) }),
    );

    await user.click(screen.getByRole("button", { name: "导出 Word" }));
    await waitFor(() => expect(createWordReport).toHaveBeenCalledTimes(1));
    const [data, report] = vi.mocked(createWordReport).mock.calls[0];
    expect(data.regions[0].current).toBe(120);
    expect(report.blocks[0].text).toBe("当前总销售额为 300 万元。");
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "what-if-report-confirmed.docx");
  });

  it("shows a recoverable error without changing the project when export fails", async () => {
    vi.mocked(downloadSalesWorkbook).mockImplementationOnce(() => {
      throw new Error("download blocked");
    });
    const user = userEvent.setup();
    render(<App />);

    const east = screen.getByLabelText("华东当前销售额");
    await user.clear(east);
    await user.type(east, "90");
    await user.click(screen.getByRole("button", { name: "导出 Excel" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Excel 导出失败");
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(90);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
  });
});
