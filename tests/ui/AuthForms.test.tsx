import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../../src/api/endpoints";
import { ApiError } from "../../src/api/errors";
import { AuthProvider } from "../../src/auth/AuthProvider";
import { AuthForms } from "../../src/components/AuthForms";
import { tokenStore } from "../../src/auth/tokenStore";

const user = { id: "u1", email: "a@b.test", displayName: "A", role: "user" as const, createdAt: "now" };

function mockApi(): Api {
  return {
    auth: {
      refresh: vi.fn(async () => { throw new Error("no session"); }),
      login: vi.fn(async () => ({ accessToken: "t1", expiresIn: 900, user })),
      register: vi.fn(async () => ({ accessToken: "t1", expiresIn: 900, user })),
      logout: vi.fn(async () => ({ ok: true })),
    },
  } as unknown as Api;
}

describe("AuthForms", () => {
  it("logs in with email and password and reports the user", async () => {
    tokenStore.clear();
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={mockApi()}><AuthForms /></AuthProvider>);
    await userEventInstance.type(screen.getByLabelText("邮箱"), "a@b.test");
    await userEventInstance.type(screen.getByLabelText("密码"), "password123");
    await userEventInstance.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(tokenStore.get()).toBe("t1"));
  });

  it("shows a readable error when login fails", async () => {
    tokenStore.clear();
    const api = mockApi();
    vi.mocked(api.auth.login).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "expired"));
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={api}><AuthForms /></AuthProvider>);
    await userEventInstance.type(screen.getByLabelText("邮箱"), "a@b.test");
    await userEventInstance.type(screen.getByLabelText("密码"), "password123");
    await userEventInstance.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("邮箱或密码不正确");
  });

  it("switches to registration mode", async () => {
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={mockApi()}><AuthForms /></AuthProvider>);
    await userEventInstance.click(screen.getByRole("button", { name: "没有账号?去注册" }));
    expect(screen.getByLabelText("显示名称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
  });
});
