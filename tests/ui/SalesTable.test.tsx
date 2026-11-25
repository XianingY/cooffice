import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalesTable } from "../../src/components/SalesTable";
import type { SalesData } from "../../src/core/types";

const data: SalesData = {
  regions: [{ id: "r1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }],
};

describe("editable amount cells", () => {
  it("commits valid values as they are typed", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<SalesTable data={data} sourceCells={[]} onEdit={onEdit} />);

    const input = screen.getByLabelText("华东当前销售额");
    await user.clear(input);
    await user.type(input, "90");

    expect(onEdit).toHaveBeenLastCalledWith("r1", 90);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the typed text visible and explains why a negative value is rejected", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<SalesTable data={data} sourceCells={[]} onEdit={onEdit} />);

    const input = screen.getByLabelText("华东当前销售额");
    await user.clear(input);
    await user.type(input, "-1");

    // The value is not silently rewritten and nothing invalid reaches the state.
    expect(input).toHaveValue(-1);
    expect(screen.getByRole("alert")).toHaveTextContent("不小于 0");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("does not rewrite an empty field to zero", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<SalesTable data={data} sourceCells={[]} onEdit={onEdit} />);

    const input = screen.getByLabelText("华东当前销售额");
    await user.clear(input);

    expect(input).toHaveValue(null);
    expect(screen.getByRole("alert")).toHaveTextContent("不能为空");
    expect(onEdit).not.toHaveBeenCalled();

    // Blur restores the last committed value instead of leaving an invalid box.
    await user.tab();
    expect(input).toHaveValue(120);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
