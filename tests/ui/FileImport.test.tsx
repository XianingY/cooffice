import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { readSalesFile } from "../../src/adapters/xlsx/salesWorkbook";
import App from "../../src/App";

vi.mock("../../src/adapters/xlsx/salesWorkbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/xlsx/salesWorkbook")>();
  return { ...actual, readSalesFile: vi.fn() };
});

describe("file import failures", () => {
  it("shows the rejection reason without replacing the current project", async () => {
    vi.mocked(readSalesFile).mockRejectedValueOnce(new Error("缺少 Sales 工作表"));
    const user = userEvent.setup();
    render(<App />);

    const east = screen.getByLabelText("华东当前销售额");
    await user.clear(east);
    await user.type(east, "90");

    const file = new File(["dummy"], "invalid.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("导入 Excel（.xlsx，需包含 Sales 工作表）"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent("缺少 Sales 工作表");
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(90);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
  });

  it("replaces state only after a successful import", async () => {
    const imported = {
      regions: [
        { id: "region-1", name: "新区域", previous: 10, current: 20, previousCell: "B2", currentCell: "C2" },
      ],
    };
    vi.mocked(readSalesFile).mockResolvedValueOnce(imported);
    const user = userEvent.setup();
    render(<App />);

    const file = new File(["dummy"], "valid.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("导入 Excel（.xlsx，需包含 Sales 工作表）"), file);

    expect(await screen.findByLabelText("新区域当前销售额")).toHaveValue(20);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
