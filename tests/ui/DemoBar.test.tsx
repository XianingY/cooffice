import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App";

describe("DemoBar and Markdown copy", () => {
  it("applies a 1-click preset and highlights source cells immediately", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /模拟华东下滑 25%/ }));
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(90);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
    expect(screen.getByText("华东 → 华西")).toBeInTheDocument();
    expect(screen.getByLabelText("华东当前销售额").className).toContain("source-cell");
  });

  it("switches scenario templates cleanly when no edits are pending", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("示例场景"), "budget");
    expect(screen.getByLabelText("研发部当前销售额")).toHaveValue(185);
    expect(screen.getByRole("button", { name: /模拟市场部追加投放/ })).toBeInTheDocument();
  });

  it("copies formatted Markdown report to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "复制 Markdown" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("# 销售数据修改影响报告");
    expect(screen.getByRole("button", { name: "已复制 Markdown" })).toBeInTheDocument();
  });
});
