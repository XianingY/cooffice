import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { serialiseProjectFile } from "../../src/adapters/storage/projectFileStorage";
import App from "../../src/App";
import { createProjectFile } from "../../src/core/projectFile";
import { salesDemo } from "../../src/fixtures/salesDemo";

function projectFileWithEast(current: number): File {
  const data = structuredClone(salesDemo);
  data.regions[0].current = current;
  const document = createProjectFile(data, data, new Date().toISOString());
  const file = new File([serialiseProjectFile(document)], "other.json", { type: "application/json" });
  // jsdom's File has no text(); the browser and Electron renderer do.
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(serialiseProjectFile(document)),
    });
  }
  return file;
}

const editEast = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const input = screen.getByLabelText("华东当前销售额");
  await user.clear(input);
  await user.type(input, value);
};

describe("import overwrite confirmation", () => {
  it("imports straight away when there is no work to lose", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText("导入项目文件"), projectFileWithEast(77));

    await waitFor(() => expect(screen.getByLabelText("华东当前销售额")).toHaveValue(77));
    expect(screen.queryByRole("dialog", { name: "替换当前项目？" })).not.toBeInTheDocument();
  });

  it("asks before replacing edited work, and cancelling keeps the draft", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user, "90");

    await user.upload(screen.getByLabelText("导入项目文件"), projectFileWithEast(77));

    const dialog = await screen.findByRole("dialog", { name: "替换当前项目？" });
    expect(dialog).toHaveTextContent("other.json");
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(90);
  });

  it("applies the pending import after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user, "90");
    await user.upload(screen.getByLabelText("导入项目文件"), projectFileWithEast(77));

    await screen.findByRole("dialog", { name: "替换当前项目？" });
    await user.click(screen.getByRole("button", { name: "确认导入" }));

    await waitFor(() => expect(screen.getByLabelText("华东当前销售额")).toHaveValue(77));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "应用修改" })).toBeDisabled();
  });

  it("dismisses the confirmation with Escape without changing data", async () => {
    const user = userEvent.setup();
    render(<App />);
    await editEast(user, "90");
    await user.upload(screen.getByLabelText("导入项目文件"), projectFileWithEast(77));

    await screen.findByRole("dialog", { name: "替换当前项目？" });
    // The dialog focuses its cancel button on open; Escape works from there.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("华东当前销售额")).toHaveValue(90);
  });
});
