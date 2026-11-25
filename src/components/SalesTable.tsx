import { useState } from "react";
import type { SalesData } from "../core/types";

interface SalesTableProps {
  data: SalesData;
  sourceCells: string[];
  onEdit(regionId: string, value: number): void;
}

/**
 * Editable "current" column. The input keeps the user's raw text while they
 * type so an empty field or a negative value is visibly rejected instead of
 * silently snapping back (or being rewritten to 0). Only valid values reach
 * the reducer; blurring an invalid field restores the last committed value.
 */
export function SalesTable({ data, sourceCells, onEdit }: SalesTableProps) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setError = (regionId: string, message: string | null) => {
    setErrors((previous) => {
      const next = { ...previous };
      if (message === null) delete next[regionId];
      else next[regionId] = message;
      return next;
    });
  };

  const clearEditing = (regionId: string) => {
    setEditing((previous) => {
      const next = { ...previous };
      delete next[regionId];
      return next;
    });
    setError(regionId, null);
  };

  return (
    <section className="panel" aria-labelledby="sales-table-title">
      <h2 id="sales-table-title">数据表格（草稿）</h2>
      <div className="table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th scope="col">区域</th>
              <th scope="col">上期</th>
              <th scope="col">当前（可编辑）</th>
            </tr>
          </thead>
          <tbody>
            {data.regions.map((region) => {
              const error = errors[region.id];
              const errorId = `cell-error-${region.id}`;
              return (
                <tr key={region.id}>
                  <th scope="row">{region.name}</th>
                  <td>{region.previous}</td>
                  <td>
                    {/* A single aria-label is the accessible name for both
                        Testing Library and Playwright label queries. */}
                    <input
                      aria-label={`${region.name}当前销售额`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? errorId : undefined}
                      className={sourceCells.includes(region.currentCell) ? "source-cell" : ""}
                      type="number"
                      min="0"
                      step="any"
                      value={editing[region.id] ?? String(region.current)}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setEditing((previous) => ({ ...previous, [region.id]: raw }));
                        if (raw.trim() === "") {
                          setError(region.id, "不能为空");
                          return;
                        }
                        const value = Number(raw);
                        if (!Number.isFinite(value) || value < 0) {
                          setError(region.id, "请输入不小于 0 的数字");
                          return;
                        }
                        setError(region.id, null);
                        onEdit(region.id, value);
                      }}
                      onBlur={() => clearEditing(region.id)}
                    />
                    {error ? (
                      <span className="cell-error" id={errorId} role="alert">
                        {error}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">“当前”列可编辑；“上期”列只读。修改只影响草稿。</p>
    </section>
  );
}
