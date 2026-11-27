/**
 * Replaceable AI provider adapters. Keys are supplied at runtime in memory
 * only: they are never written to localStorage, project files, logs or errors.
 * Providers return text only; number safety is enforced by core/aiGuard.
 */
export interface AiProvider {
  readonly id: string;
  polish(text: string, signal?: AbortSignal): Promise<string>;
}

export interface HttpProviderOptions {
  endpoint: string;
  key: string;
  model: string;
  fetch?: typeof fetch;
  /** Timeout per polish request in milliseconds; 0 disables timeout. */
  timeoutMs?: number;
}

/** Deterministic fallback: always available, no network, no key. */
export function createDeterministicProvider(): AiProvider {
  return {
    id: "deterministic",
    async polish(text: string) {
      return text;
    },
  };
}

/** Minimal OpenAI-compatible chat-completions provider with timeout & abort support. */
export function createHttpProvider(options: HttpProviderOptions): AiProvider {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 30_000;
  return {
    id: "http",
    async polish(text: string, signal?: AbortSignal) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
      const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await doFetch(options.endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.key}`,
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              {
                role: "system",
                content: "只润色中文报告的措辞,保持所有数字、单位和结论不变,不要新增事实。",
              },
              { role: "user", content: text },
            ],
          }),
        });
        if (!response.ok) throw new Error(`润色服务返回错误(${response.status})`);
        const body = (await response.json()) as { choices?: { message?: { content?: string } }[]; text?: string };
        const polished = body.choices?.[0]?.message?.content ?? body.text ?? "";
        if (polished.trim() === "") throw new Error("润色结果为空");
        return polished.trim();
      } finally {
        if (timer !== null) clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
