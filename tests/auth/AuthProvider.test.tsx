import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../../src/api/endpoints";
import { AuthProvider, useAuth } from "../../src/auth/AuthProvider";
import { tokenStore } from "../../src/auth/tokenStore";

const user = { id: "u1", email: "a@b.test", displayName: "A", role: "user" as const, createdAt: "now" };

function mockApi(refreshImpl: () => Promise<{ accessToken: string; user: typeof user }>) {
  return {
    auth: {
      refresh: vi.fn(refreshImpl),
      login: vi.fn(async () => ({ accessToken: "access-1", expiresIn: 900, user })),
      register: vi.fn(async () => ({ accessToken: "access-1", expiresIn: 900, user })),
      logout: vi.fn(async () => ({ ok: true })),
    },
  } as unknown as Api;
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user?.email ?? "anonymous"}</span>
      <button onClick={() => void auth.signIn("a@b.test", "password123")}>sign in</button>
      <button onClick={() => void auth.signOut()}>sign out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("restores a session from the refresh cookie and stores the token in memory", async () => {
    tokenStore.clear();
    const api = mockApi(async () => ({ accessToken: "restored", user }));
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@b.test"));
    expect(tokenStore.get()).toBe("restored");
    expect(localStorage.getItem("access-token")).toBeNull();
  });

  it("treats a missing session as anonymous", async () => {
    tokenStore.clear();
    const api = mockApi(async () => { throw new Error("no cookie"); });
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("anonymous"));
  });

  it("signs in and clears the in-memory token on sign out", async () => {
    tokenStore.clear();
    const api = mockApi(async () => { throw new Error("no cookie"); });
    const userEventInstance = userEvent.setup();
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("anonymous"));
    await userEventInstance.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@b.test"));
    expect(tokenStore.get()).toBe("access-1");

    await userEventInstance.click(screen.getByRole("button", { name: "sign out" }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("anonymous"));
    expect(tokenStore.get()).toBeNull();
  });
});
