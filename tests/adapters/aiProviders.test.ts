import { describe, expect, it, vi } from "vitest";
import {
  createDeterministicProvider,
  createHttpProvider,
} from "../../src/adapters/ai/aiProviders";

describe("deterministic provider", () => {
  it("returns the original text unchanged and is always available", async () => {
    const provider = createDeterministicProvider();
    expect(await provider.polish("当前总销售额为 300 万元。")).toBe("当前总销售额为 300 万元。");
  });
});

describe("http provider", () => {
  const validResponse = {
    ok: true,
    json: async () => ({ text: "本期总销售额为 300 万元。" }),
  };

  it("sends the key in the Authorization header and returns provider text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(validResponse);
    const provider = createHttpProvider({
      endpoint: "https://api.example.com/v1/polish",
      key: "sk-runtime-only",
      model: "test-model",
      fetch: fetchMock,
    });
    expect(await provider.polish("当前总销售额为 300 万元。")).toBe("本期总销售额为 300 万元。");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/polish");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-runtime-only");
    expect(JSON.parse(init.body).model).toBe("test-model");
  });

  it("rejects non-ok responses and empty text", async () => {
    const failing = createHttpProvider({
      endpoint: "https://api.example.com/v1/polish",
      key: "k",
      model: "m",
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    });
    await expect(failing.polish("文本")).rejects.toThrow("润色服务");

    const empty = createHttpProvider({
      endpoint: "https://api.example.com/v1/polish",
      key: "k",
      model: "m",
      fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "   " }) }),
    });
    await expect(empty.polish("文本")).rejects.toThrow("润色结果为空");
  });

  it("never places the key in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(validResponse);
    const provider = createHttpProvider({
      endpoint: "https://api.example.com/v1/polish",
      key: "sk-secret",
      model: "m",
      fetch: fetchMock,
    });
    await provider.polish("文本");
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.stringify(JSON.parse(init.body))).not.toContain("sk-secret");
  });
});
