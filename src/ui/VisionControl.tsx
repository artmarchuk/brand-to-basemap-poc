import { feColorMatrixValues, SIMULATIONS, VISION_LABELS, VISION_MODES, visionFilterId, type VisionMode } from '../vision/simulate';

interface Props {
  mode: VisionMode;
  onMode: (mode: VisionMode) => void;
}

/**
 * Colour-vision preview: picks the filter the map canvas is drawn through. Preview only. It is local UI
 * state, so it never reaches the tokens, the share link, the autosave or an export.
 */
export function VisionControl({ mode, onMode }: Props) {
  return (
    <label className="field field-inline">
      <span className="label">Colour vision</span>
      <select className="select" value={mode} onChange={(event) => onMode(event.target.value as VisionMode)}>
        {VISION_MODES.map((option) => (
          <option key={option} value={option}>{VISION_LABELS[option]}</option>
        ))}
      </select>
      {mode !== 'none' && <span className="hint vision-note" role="status">Preview only: the map and the exports are unchanged.</span>}
    </label>
  );
}

/** The SVG filters the map canvas refers to by id. Rendered once; it takes no space. */
export function VisionFilters() {
  return (
    <svg className="vision-filters" aria-hidden="true" focusable="false">
      <defs>
        {SIMULATIONS.map((simulation) => (
          <filter key={simulation} id={visionFilterId(simulation)} colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values={feColorMatrixValues(simulation)} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
