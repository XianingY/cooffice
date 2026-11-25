import type { ChartModel } from "../core/types";

interface RegionChartProps {
  chart: ChartModel;
}

/** Minimal accessible CSS bar chart; no chart library, fully deterministic. */
export function RegionChart({ chart }: RegionChartProps) {
  const max = Math.max(1, ...chart.data.map((datum) => datum.value));

  return (
    <section className="panel chart-panel" aria-labelledby="chart-title">
      <h2 id="chart-title">{chart.title}</h2>
      <figure className="chart-figure">
        {/* The bars are decorative; the table below carries the same data for
            screen readers, which cannot extract values from a CSS bar chart. */}
        <div className="chart-bars" aria-hidden="true">
          {chart.data.map((datum) => (
            <div key={datum.regionId} className="chart-row">
              <span className="chart-label">{datum.name}</span>
              <span className="chart-track">
                <span
                  className="chart-bar"
                  style={{ width: `${(datum.value / max) * 100}%` }}
                />
              </span>
              <span className="chart-value">
                {datum.value} {chart.unit}
              </span>
            </div>
          ))}
        </div>
        {chart.data.length === 0 ? (
          <p className="hint">暂无区域数据</p>
        ) : (
          <table className="visually-hidden">
            <caption>
              {chart.title}（单位：{chart.unit}）
            </caption>
            <thead>
              <tr>
                <th scope="col">区域</th>
                <th scope="col">销售额（{chart.unit}）</th>
              </tr>
            </thead>
            <tbody>
              {chart.data.map((datum) => (
                <tr key={datum.regionId}>
                  <th scope="row">{datum.name}</th>
                  <td>{datum.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </figure>
    </section>
  );
}
