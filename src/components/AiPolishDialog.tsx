import { useEffect, useRef, useState } from "react";
import { createDeterministicProvider, createHttpProvider } from "../adapters/ai/aiProviders";
import { assertNumbersPreserved } from "../core/aiGuard";
import type { ReportModel } from "../core/types";
import { getDesktop } from "../desktop/bridge";
import { Dialog } from "./Dialog";

interface AiPolishDialogProps {
  report: ReportModel;
  onResult(text: string): void;
  onFallback(message: string): void;
  onClose(): void;
}

/**
 * Opt-in copy editing. Endpoint, model and key are kept only in component
 * state for this dialog's lifetime; they are never persisted or logged.
 */
export function AiPolishDialog({ report, onResult, onFallback, onClose }: AiPolishDialogProps) {
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const original = report.blocks.map((block) => block.text).join("\n");

  const handlePolish = async () => {
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    // Deterministic template fallback is always the safe baseline.
    const fallback = createDeterministicProvider();
    try {
      let polished: string;
      if (endpoint.trim() === "" || model.trim() === "" || key.trim() === "") {
        polished = await fallback.polish(original);
      } else {
        const desktop = getDesktop();
        if (desktop?.polishText) {
          // Desktop renderer runs under strict connect-src 'self' CSP; proxy
          // the opt-in HTTPS call through the main process without logging keys.
          const reply = await desktop.polishText({
            endpoint: endpoint.trim(),
            model: model.trim(),
            key,
            text: original,
          });
          if (reply.error || !reply.text) throw new Error(reply.error ?? "润色结果为空");
          polished = reply.text;
        } else {
          const provider = createHttpProvider({ endpoint: endpoint.trim(), model: model.trim(), key });
          polished = await provider.polish(original, controller.signal);
        }
        assertNumbersPreserved(original, polished);
      }
      if (!controller.signal.aborted) onResult(polished);
    } catch {
      if (controller.signal.aborted) return;
      const deterministic = await fallback.polish(original);
      onResult(deterministic);
      onFallback("AI 润色失败或改变了报告数值,已回退到确定性模板;原报告未被修改");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setKey("");
      setBusy(false);
    }
  };

  return (
    <Dialog labelledBy="ai-dialog-title" onClose={onClose}>
      <h2 id="ai-dialog-title">AI 润色设置</h2>
      <p className="hint">
        AI 仅润色文字措辞,不参与数值计算与影响判断;结果需人工核对。留空将使用确定性模板(原文)。
      </p>
      <div className="mapping-fields">
        <label>
          接口地址
          <input
            aria-label="接口地址"
            data-autofocus
            type="text"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </label>
        <label>
          模型名称
          <input
            aria-label="模型名称"
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </label>
        <label>
          运行时密钥
          <input
            aria-label="运行时密钥"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          关闭
        </button>
        <button type="button" className="primary" onClick={handlePolish} disabled={busy}>
          {busy ? "润色中…" : "润色已确认报告"}
        </button>
      </div>
    </Dialog>
  );
}
