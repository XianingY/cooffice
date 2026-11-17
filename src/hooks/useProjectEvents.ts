import { useEffect, useRef, useState } from "react";
import { tokenStore } from "../auth/tokenStore";
import { sessionHeaders } from "../desktop/bridge";

/**
 * Subscribe to server-sent project changes using fetch streaming, which (unlike
 * EventSource) can carry the bearer token in an Authorization header. Tokens
 * are never placed in URLs. Reconnects with capped backoff on disconnect.
 */
export function useProjectEvents(projectId: string | null, onEvent: () => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = tokenStore.get();
    if (!projectId || !token) return;

    let disposed = false;
    let controller: AbortController | null = null;
    let retry = 0;

    const connect = async () => {
      if (disposed) return;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/events`, {
          headers: { Authorization: `Bearer ${tokenStore.get() ?? token}`, ...sessionHeaders() },
          signal: controller.signal,
          credentials: "include",
        });
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
        if (!disposed) {
          setConnected(false);
          retry += 1;
          const delay = Math.min(1000 * 2 ** Math.min(retry, 4), 15_000);
          setTimeout(() => void connect(), delay);
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      controller?.abort();
      setConnected(false);
    };
  }, [projectId]);

  return connected;
}
