import { useState } from "react";
import type { ColumnMapping, TabularInput } from "../core/types";
import { Dialog } from "./Dialog";

interface ColumnMappingDialogProps {
  input: TabularInput;
  suggested: ColumnMapping;
  onConfirm(mapping: ColumnMapping): void;
  onCancel(): void;
}

const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "region", label: "区域名称" },
  { key: "previous", label: "上期销售额" },
  { key: "current", label: "当前销售额" },
];

export function ColumnMappingDialog({ input, suggested, onConfirm, onCancel }: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(suggested);
  const preview = input.rows.slice(0, 3);

  return (
    <Dialog labelledBy="mapping-dialog-title" describedBy="mapping-dialog-description" onClose={onCancel}>
      <h2 id="mapping-dialog-title">确认列映射</h2>
      <p id="mapping-dialog-description">
        检测到以下列,请确认每列对应的含义。原始数据不会被修改。
      </p>
      <div className="mapping-fields">
        {FIELDS.map(({ key, label }, index) => (
          <label key={key}>
            {label}
            <select
              aria-label={`${label}所在列`}
              data-autofocus={index === 0 ? true : undefined}
              value={mapping[key]}
              onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}
            >
              {input.headers.map((header, columnIndex) => (
                <option key={`${columnIndex}-${header}`} value={columnIndex}>
                  {header || `第 ${columnIndex + 1} 列`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <table className="mapping-preview">
        <thead>
          <tr>
            <th>区域</th>
            <th>上期</th>
            <th>当前</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((row, index) => (
            <tr key={index}>
              <td>{row[mapping.region]}</td>
              <td>{row[mapping.previous]}</td>
              <td>{row[mapping.current]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>
          取消映射
        </button>
        <button type="button" className="primary" onClick={() => onConfirm(mapping)}>
          确认映射并导入
        </button>
      </div>
    </Dialog>
  );
}
