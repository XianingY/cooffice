import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { readCsvFile } from "../../src/adapters/csv/salesCsv";

vi.mock("../../src/adapters/csv/salesCsv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/csv/salesCsv")>();
  return { ...actual, readCsvFile: vi.fn() };
});

const csvFile = new File(["dummy"], "sales.csv", { type: "text/csv" });

describe("CSV guided column mapping", () => {
  it("asks for confirmation before applying a detected mapping", async () => {
    vi.mocked(readCsvFile).mockResolvedValueOnce({
      headers: ["区域", "上期", "当前"],
      rows: [["华东", "100", "120"], ["华西", "90", "100"]],
      source: "csv",
    });
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText("导入 Excel 或 CSV"), csvFile);

    const dialog = await screen.findByRole("dialog", { name: "确认列映射" });
    expect(within(dialog).getByLabelText("区域名称所在列")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认映射并导入" })).toBeInTheDocument();
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(120);
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认映射并导入" }));
    expect(screen.queryByRole("dialog", { name: "确认列映射" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("华西当前销售额")).toHaveValue(100);
  });

  it("can cancel the mapping without changing the project", async () => {
    vi.mocked(readCsvFile).mockResolvedValueOnce({
      headers: ["region", "previous", "current"],
      rows: [["新区域", "10", "20"]],
      source: "csv",
    });
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText("导入 Excel 或 CSV"), csvFile);

    await screen.findByRole("dialog", { name: "确认列映射" });
    await user.click(screen.getByRole("button", { name: "取消映射" }));
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(120);
    expect(screen.queryByLabelText("新区域当前销售额")).not.toBeInTheDocument();
  });

  it("shows a specific error when a CSV row has invalid numbers", async () => {
    vi.mocked(readCsvFile).mockResolvedValueOnce({
      headers: ["region", "previous", "current"],
      rows: [["华东", "一百", "120"]],
      source: "csv",
    });
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText("导入 Excel 或 CSV"), csvFile);

    await screen.findByRole("dialog", { name: "确认列映射" });
    await user.click(screen.getByRole("button", { name: "确认映射并导入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("第 2 行");
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(120);
  });
});
