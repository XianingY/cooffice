import type { SalesData } from "../core/types";

interface SalesTableProps {
  data: SalesData;
  sourceCells: string[];
  onEdit(regionId: string, value: number): void;
}

export function SalesTable({ data, sourceCells, onEdit }: SalesTableProps) {
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
            {data.regions.map((region) => (
              <tr key={region.id}>
                <th scope="row">{region.name}</th>
                <td>{region.previous}</td>
                <td>
                  {/* A single aria-label is the accessible name for both
                      Testing Library and Playwright label queries. */}
                  <input
                    aria-label={`${region.name}当前销售额`}
                    className={sourceCells.includes(region.currentCell) ? "source-cell" : ""}
                    type="number"
                    min="0"
                    step="any"
                    value={region.current}
                    onChange={(event) =>
                      onEdit(region.id, event.target.value === "" ? 0 : event.target.valueAsNumber)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">“当前”列可编辑；“上期”列只读。修改只影响草稿。</p>
    </section>
  );
}
