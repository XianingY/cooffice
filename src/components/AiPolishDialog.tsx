import { useState } from "react";
import { createDeterministicProvider, createHttpProvider } from "../adapters/ai/aiProviders";
import { assertNumbersPreserved } from "../core/aiGuard";
import type { ReportModel } from "../core/types";

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

  const original = report.blocks.map((block) => block.text).join("\n");

  const handlePolish = async () => {
    setBusy(true);
    // Deterministic template fallback is always the safe baseline.
    const fallback = createDeterministicProvider();
    try {
      let polished: string;
      if (endpoint.trim() === "" || model.trim() === "" || key.trim() === "") {
        polished = await fallback.polish(original);
      } else {
        const provider = createHttpProvider({ endpoint, model, key });
        polished = await provider.polish(original);
        assertNumbersPreserved(original, polished);
      }
      onResult(polished);
    } catch {
      const deterministic = await fallback.polish(original);
      onResult(deterministic);
      onFallback("AI 润色失败或改变了报告数值,已回退到确定性模板;原报告未被修改");
    } finally {
      setKey("");
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title" className="dialog">
        <h2 id="ai-dialog-title">AI 润色设置</h2>
        <p className="hint">
          AI 仅润色文字措辞,不参与数值计算与影响判断;结果需人工核对。留空将使用确定性模板(原文)。
        </p>
        <div className="mapping-fields">
          <label>
            接口地址
            <input
              aria-label="接口地址"
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
      </div>
    </div>
  );
}
