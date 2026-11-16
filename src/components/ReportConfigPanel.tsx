import type { ReportBlockId, ReportConfig } from "../core/types";

interface ReportConfigPanelProps {
  config: ReportConfig;
  onChange(config: ReportConfig): void;
}

const BLOCK_LABELS: Record<ReportBlockId, string> = {
  summary: "总额结论",
  growthNarrative: "同比增长率",
  leaderNarrative: "第一名结论",
};

const ALL_BLOCKS: ReportBlockId[] = ["summary", "growthNarrative", "leaderNarrative"];

/** Toggle and reorder report blocks. All changes flow through onChange. */
export function ReportConfigPanel({ config, onChange }: ReportConfigPanelProps) {
  const move = (id: ReportBlockId, direction: -1 | 1) => {
    const blocks = [...config.blocks];
    const index = blocks.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    onChange({ blocks });
  };

  const toggle = (id: ReportBlockId, enabled: boolean) => {
    // Append on enable and remove on disable, preserving any custom order
    // the user has already chosen for the remaining blocks.
    const blocks = enabled ? [...config.blocks, id] : config.blocks.filter((block) => block !== id);
    onChange({ blocks });
  };

  return (
    <section className="panel config-panel" aria-labelledby="config-title">
      <h2 id="config-title">报告配置</h2>
      <div role="group" aria-label="报告块配置" className="config-group">
        {ALL_BLOCKS.map((id) => {
          const enabled = config.blocks.includes(id);
          const position = config.blocks.indexOf(id);
          return (
            <div key={id} className="config-row">
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  aria-label={`显示${BLOCK_LABELS[id]}`}
                  onChange={(event) => toggle(id, event.target.checked)}
                />
                {BLOCK_LABELS[id]}
              </label>
              {enabled ? (
                <span className="config-order">
                  <button
                    type="button"
                    aria-label={`上移${BLOCK_LABELS[id]}`}
                    disabled={position === 0}
                    onClick={() => move(id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`下移${BLOCK_LABELS[id]}`}
                    disabled={position === config.blocks.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="hint">勾选需要展示的结论,用箭头调整顺序。配置随项目文件保存。</p>
    </section>
  );
}
