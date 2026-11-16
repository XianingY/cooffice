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
      <div className="chart-bars" role="img" aria-label={`${chart.title},单位${chart.unit}`}>
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
        {chart.data.length === 0 ? <p className="hint">暂无区域数据</p> : null}
      </div>
    </section>
  );
}
