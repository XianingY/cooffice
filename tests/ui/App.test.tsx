import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { STORAGE_KEY, saveProject } from "../../src/adapters/storage/projectStorage";
import { createProjectFile } from "../../src/core/projectFile";
import { salesDemo } from "../../src/fixtures/salesDemo";

const eastInput = () => screen.getByLabelText("华东当前销售额");
const editEast = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.clear(eastInput());
  await user.type(eastInput(), "90");
};

describe("impact preview", () => {
  it("previews the east edit and navigates to evidence", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = eastInput();
    await editEast(user);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
    expect(screen.getByText("20.00% → 8.00%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看总销售额来源" }));
    expect(input).toHaveClass("source-cell");
    expect(screen.getByText("当前总销售额为 270 万元。")).toHaveClass("source-report");
  });

  it("starts from the fictional example with no impacts", () => {
    render(<App />);
    expect(eastInput()).toHaveValue(120);
    expect(screen.getAllByText("当前总销售额为 300 万元。")).toHaveLength(2);
    expect(screen.getByText("当前草稿与已确认版本一致，暂无影响项。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "应用修改" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "撤销草稿" })).toBeDisabled();
  });

  it("applies the draft and clears all impacts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "应用修改" }));
    expect(eastInput()).toHaveValue(90);
    expect(screen.getByText("当前草稿与已确认版本一致，暂无影响项。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "应用修改" })).toBeDisabled();
  });

  it("reverts the draft back to the confirmed baseline", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user);
    await user.click(screen.getByRole("button", { name: "撤销草稿" }));
    expect(eastInput()).toHaveValue(120);
    expect(screen.getByText("当前草稿与已确认版本一致，暂无影响项。")).toBeInTheDocument();
  });

  it("requires a second confirmation before clearing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user);
    await user.click(screen.getByRole("button", { name: "清除本地项目" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(eastInput()).toHaveValue(90);

    await user.click(screen.getByRole("button", { name: "清除本地项目" }));
    await user.click(screen.getByRole("button", { name: "确认清除" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(eastInput()).toHaveValue(120);
  });

  it("removes the stored snapshot after clearing without writing it back", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "清除本地项目" }));
    await user.click(screen.getByRole("button", { name: "确认清除" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores a persisted draft on load", () => {
    const draft = structuredClone(salesDemo);
    draft.regions[0].current = 90;
    saveProject(
      createProjectFile(salesDemo, draft, new Date().toISOString())
    );
    render(<App />);
    expect(eastInput()).toHaveValue(90);
    expect(screen.getByText("300 万元 → 270 万元")).toBeInTheDocument();
  });
});
