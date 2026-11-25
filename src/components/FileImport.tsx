import { useState, type ChangeEvent } from "react";
import { importTabularFile } from "../adapters/tabular/importTabularFile";
import type { ColumnMapping, SalesData, TabularInput } from "../core/types";

interface FileImportProps {
  onImport(data: SalesData): void;
  onCsvInput(input: TabularInput, suggested: ColumnMapping): void;
  onError(message: string): void;
}

export function FileImport({ onImport, onCsvInput, onError }: FileImportProps) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const result = await importTabularFile(file);
      onError("");
      if (result.kind === "csv") onCsvInput(result.input, result.suggested);
      else onImport(result.data);
    } catch (error) {
      // Only the adapter's human-readable reason is shown; file content is
      // never logged or placed into UI state.
      onError(error instanceof Error ? error.message : "文件导入失败，请检查文件后重试");
    } finally {
      setBusy(false);
      input.value = ""; // allow re-importing the same filename
    }
  };

  return (
    <div className="file-import">
      <label htmlFor="sales-file">导入 Excel 或 CSV</label>
      <input
        id="sales-file"
        type="file"
        accept=".xlsx,.xls,.csv"
        disabled={busy}
        onChange={handleChange}
      />
      <span className="hint">{busy ? "正在读取本地文件…" : "文件不会上传到服务器"}</span>
    </div>
  );
}
