import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("report configuration UI", () => {
  it("renders the default chart and lets the user reorder report blocks", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "各区域当前销售额" })).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /各区域当前销售额/ });
    expect(chart.textContent).toContain("华东");

    const config = screen.getByRole("group", { name: "报告块配置" });
    // Move the leader conclusion up twice so it precedes the summary.
    await user.click(within(config).getByRole("button", { name: "上移第一名结论" }));
    await user.click(within(config).getByRole("button", { name: "上移第一名结论" }));

    // Reordering is reflected in the preview immediately.
    const preview = screen.getByRole("region", { name: "草稿报告" });
    expect(preview.textContent?.indexOf("华东销售额最高。")).toBeLessThan(
      preview.textContent?.indexOf("当前总销售额为 300 万元。") ?? 0,
    );
  });

  it("can toggle a block off so it disappears from the report", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("checkbox", { name: "显示同比增长率" }));
    const preview = screen.getByRole("region", { name: "草稿报告" });
    expect(preview.textContent).not.toContain("同比增长率为");
  });
});
