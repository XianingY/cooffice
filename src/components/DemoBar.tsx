import { SCENARIO_TEMPLATES, type ScenarioPreset, type ScenarioTemplate } from "../core/templates";

interface DemoBarProps {
  activeTemplate: ScenarioTemplate;
  onSelectTemplate(template: ScenarioTemplate): void;
  onApplyPreset(preset: ScenarioPreset): void;
}

/**
 * Interactive 3-second onboarding strip: lets first-time visitors trigger a
 * realistic what-if change (with automatic source-cell highlighting) or switch
 * between built-in scenario templates in one click.
 */
export function DemoBar({ activeTemplate, onSelectTemplate, onApplyPreset }: DemoBarProps) {
  return (
    <section className="demo-bar" aria-label="快速体验场景">
      <div className="demo-bar-group">
        <label className="demo-template-select" htmlFor="scenario-template-select">
          <span>示例场景</span>
          <select
            id="scenario-template-select"
            value={activeTemplate.id}
            onChange={(event) => {
              const next = SCENARIO_TEMPLATES.find((item) => item.id === event.target.value);
              if (next) onSelectTemplate(next);
            }}
          >
            {SCENARIO_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <div className="demo-presets">
          {activeTemplate.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="demo-preset-button"
              title={preset.description}
              onClick={() => onApplyPreset(preset)}
            >
              试一试：{preset.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
