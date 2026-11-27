import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../../src/api/endpoints";
import { AuthProvider } from "../../src/auth/AuthProvider";
import { ProfilePanel } from "../../src/components/ProfilePanel";

const user = { id: "u1", email: "a@b.test", displayName: "Old", role: "user" as const, createdAt: "now" };

function apiWith(overrides: Partial<Api["auth"]> = {}): Api {
  return {
    auth: {
      refresh: vi.fn(async () => ({ accessToken: "t", user })),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(async () => ({ ok: true })),
      me: vi.fn(),
      updateProfile: vi.fn(async (name: string) => ({ ...user, displayName: name })),
      changePassword: vi.fn(async () => ({ ok: true })),
      ...overrides,
    },
  } as unknown as Api;
}

describe("ProfilePanel", () => {
  it("updates display name and shows confirmation", async () => {
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={apiWith()}><ProfilePanel api={apiWith()} /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("新的显示名称")).toHaveValue("Old"));
    await userEventInstance.clear(screen.getByLabelText("新的显示名称"));
    await userEventInstance.type(screen.getByLabelText("新的显示名称"), "New Name");
    await userEventInstance.click(screen.getByRole("button", { name: "保存名称" }));
    expect(await screen.findByRole("status")).toHaveTextContent("New Name");
    expect(screen.getByLabelText("新的显示名称")).toHaveValue("New Name");
  });

  it("changes password and clears the fields", async () => {
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={apiWith()}><ProfilePanel api={apiWith()} /></AuthProvider>);
    await screen.findByLabelText("当前密码");
    await userEventInstance.type(screen.getByLabelText("当前密码"), "old-password");
    await userEventInstance.type(screen.getByLabelText("新密码"), "new-password");
    await userEventInstance.click(screen.getByRole("button", { name: "修改密码" }));
    expect(await screen.findByRole("status")).toHaveTextContent("密码已修改");
    expect(screen.getByLabelText("当前密码")).toHaveValue("");
  });

  it("shows an error when the current password is wrong", async () => {
    const api = apiWith({
      changePassword: vi.fn(async () => { throw new Error("wrong"); }),
    });
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={api}><ProfilePanel api={api} /></AuthProvider>);
    await screen.findByLabelText("当前密码");
    await userEventInstance.type(screen.getByLabelText("当前密码"), "bad");
    await userEventInstance.type(screen.getByLabelText("新密码"), "new-password");
    await userEventInstance.click(screen.getByRole("button", { name: "修改密码" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("修改密码失败");
  });
});
