import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRefreshHandler } from "../../src/api/factory";
import { tokenStore } from "../../src/auth/tokenStore";
import { useProjectEvents } from "../../src/hooks/useProjectEvents";

function Probe({ projectId, onEvent }: { projectId: string | null; onEvent(): void }) {
  const connected = useProjectEvents(projectId, onEvent);
  return <span data-testid="sse">{connected ? "connected" : "disconnected"}</span>;
}

afterEach(() => {
  tokenStore.clear();
  vi.restoreAllMocks();
  setRefreshHandler(async () => false);
});

describe("useProjectEvents", () => {
  it("refreshes the access token on 401 and reconnects with the new token", async () => {
    tokenStore.set("expired-token");
    const refresh = vi.fn(async () => {
      tokenStore.set("fresh-token");
      return true;
    });
    setRefreshHandler(refresh);

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const { unmount } = render(<Probe projectId="p1" onEvent={vi.fn()} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(1);
    const secondHeaders = fetchSpy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(secondHeaders.Authorization).toBe("Bearer fresh-token");
    unmount();
  });

  it("stops reconnecting on permanent 403/404 responses", async () => {
    tokenStore.set("valid-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    const { unmount } = render(<Probe projectId="p1" onEvent={vi.fn()} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    unmount();
  });
});
