import type { Impact, ImpactId, ImpactKind } from "../core/types";

interface ImpactListProps {
  impacts: Impact[];
  selectedImpactId: ImpactId | null;
  onSelect(impact: Impact): void;
}

const KIND_LABELS: Record<ImpactKind, string> = {
  metric: "指标",
  ranking: "排名",
  narrative: "报告结论",
};

export function ImpactList({ impacts, selectedImpactId, onSelect }: ImpactListProps) {
  return (
    <section className="panel" aria-labelledby="impact-list-title">
      <h2 id="impact-list-title">影响列表</h2>
      {/* Editing a cell changes this list without moving focus, so announce it. */}
      <p className="visually-hidden" aria-live="polite">
        {impacts.length === 0
          ? "影响列表已更新，当前没有影响项"
          : `影响列表已更新，共 ${impacts.length} 项，首项 ${impacts[0].label}：${impacts[0].before} 到 ${impacts[0].after}`}
      </p>
      {impacts.length === 0 ? (
        <p className="empty">当前草稿与已确认版本一致，暂无影响项。</p>
      ) : (
        <ul className="impact-list">
          {impacts.map((impact) => (
            <li key={impact.id}>
              <button
                type="button"
                className={selectedImpactId === impact.id ? "impact-item selected" : "impact-item"}
                aria-label={`查看${impact.label}来源`}
                aria-pressed={selectedImpactId === impact.id}
                onClick={() => onSelect(impact)}
              >
                <span className="impact-kind">{KIND_LABELS[impact.kind]}</span>
                <span className="impact-label">{impact.label}</span>
                <span className="impact-values">{impact.before} → {impact.after}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
