import { useEffect, useRef, useState } from "react";
import { apiUrl, refreshSession } from "../api/factory";
import { tokenStore } from "../auth/tokenStore";
import { sessionHeaders } from "../desktop/bridge";

/**
 * Subscribe to server-sent project changes using fetch streaming, which (unlike
 * EventSource) can carry the bearer token in an Authorization header. Tokens
 * are never placed in URLs. Refreshes expired tokens on 401, stops on
 * permanent 403/404 responses, and cleans up reconnect timers on unmount.
 */
export function useProjectEvents(projectId: string | null, onEvent: () => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const initialToken = tokenStore.get();
    if (!projectId || !initialToken) return;

    let disposed = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retry = 0;

    const scheduleReconnect = (delayMs?: number) => {
      if (disposed) return;
      retry += 1;
      const delay = delayMs ?? Math.min(1000 * 2 ** Math.min(retry, 4), 15_000);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (disposed) return;
      const activeToken = tokenStore.get();
      if (!activeToken) return;
      controller = new AbortController();
      let shouldRetry = true;
      let immediateRetry = false;
      try {
        const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/events`), {
          headers: { Authorization: `Bearer ${activeToken}`, ...sessionHeaders() },
          signal: controller.signal,
          credentials: "include",
        });
        if (response.status === 401) {
          const recovered = await refreshSession();
          shouldRetry = recovered;
          immediateRetry = recovered;
          return;
        }
        if (response.status === 403 || response.status === 404) {
          shouldRetry = false;
          return;
        }
        if (!response.ok || !response.body) throw new Error("SSE unavailable");
        setConnected(true);
        retry = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            if (block.includes("event: project-change")) onEventRef.current();
          }
        }
      } catch {
        // Abort during cleanup is expected; other failures trigger reconnect.
      } finally {
        setConnected(false);
        if (!disposed && shouldRetry) {
          scheduleReconnect(immediateRetry ? 0 : undefined);
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      controller?.abort();
      setConnected(false);
    };
  }, [projectId]);

  return connected;
}
