import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { assertNumbersPreserved } from "../../src/core/aiGuard";

vi.mock("../../src/adapters/ai/aiProviders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/ai/aiProviders")>();
  return {
    ...actual,
    createHttpProvider: vi.fn(() => ({
      id: "http",
      // Keep every numeric token from the original report so the numeric
      // guard passes; this is what a compliant polish result looks like.
      polish: vi.fn().mockResolvedValue("本期总销售额为 300 万元整,同比增长率为 20.00%,华东销售额最高。"),
    })),
  };
});

describe("AI polish (opt-in)", () => {
  it("does not call any provider until the user opts in", () => {
    render(<App />);
    const preview = screen.getByRole("region", { name: "草稿报告" });
    expect(preview.textContent).toContain("当前总销售额为 300 万元。");
    expect(preview.textContent).not.toContain("本期总销售额为 300 万元整。");
  });

  it("polishes the baseline report only after explicit confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "AI 润色设置" }));
    const dialog = screen.getByRole("dialog", { name: "AI 润色设置" });
    await user.type(withinDialog(dialog, "接口地址"), "https://api.example.com/v1/polish");
    await user.type(withinDialog(dialog, "模型名称"), "test-model");
    await user.type(withinDialog(dialog, "运行时密钥"), "sk-runtime-only");
    await user.click(screen.getByRole("button", { name: "润色已确认报告" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "AI 润色结果" }).textContent).toContain(
        "本期总销售额为 300 万元整",
      );
    });
    expect(
      assertNumbersPreserved(
        "当前总销售额为 300 万元。\n同比增长率为 20.00%。\n华东销售额最高。",
        "本期总销售额为 300 万元整,同比增长率为 20.00%,华东销售额最高。",
      ),
    ).toBeUndefined();
    expect(localStorage.getItem("what-if-report:project:v1")).not.toContain("sk-runtime-only");
  });

  it("shows a fallback notice when the provider fails", async () => {
    const user = userEvent.setup();
    const { createHttpProvider } = await import("../../src/adapters/ai/aiProviders");
    vi.mocked(createHttpProvider).mockImplementationOnce(() => ({
      id: "http",
      polish: vi.fn().mockRejectedValue(new Error("service down")),
    }));

    render(<App />);
    await user.click(screen.getByRole("button", { name: "AI 润色设置" }));
    const dialog = screen.getByRole("dialog", { name: "AI 润色设置" });
    await user.type(withinDialog(dialog, "接口地址"), "https://api.example.com/v1/polish");
    await user.type(withinDialog(dialog, "模型名称"), "test-model");
    await user.type(withinDialog(dialog, "运行时密钥"), "k");
    await user.click(screen.getByRole("button", { name: "润色已确认报告" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("确定性模板");
    });
  });
});

function withinDialog(dialog: HTMLElement, label: string): HTMLElement {
  const input = Array.from(dialog.querySelectorAll("input")).find(
    (el) => el.getAttribute("aria-label") === label,
  );
  if (!input) throw new Error(`missing input ${label}`);
  return input;
}
