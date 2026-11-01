import * as Slider from '@radix-ui/react-slider';
import type { Mode } from '../tokens/types';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'data', label: 'Data' },
];

interface Props {
  mode: Mode;
  recede: number;
  overlay: boolean;
  onMode: (mode: Mode) => void;
  onRecede: (recede: number) => void;
  onOverlay: (on: boolean) => void;
}

export function ModePanel({ mode, recede, overlay, onMode, onRecede, onOverlay }: Props) {
  return (
    <section className="panel-section" aria-labelledby="mode-heading">
      <h2 id="mode-heading" className="panel-heading">Mode</h2>
      <div className="segmented" role="radiogroup" aria-labelledby="mode-heading">
        {MODES.map((item) => (
          <label key={item.mode} className="segment">
            <input type="radio" name="mode" checked={mode === item.mode} onChange={() => onMode(item.mode)} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {mode === 'data' && (
        <>
          <div className="row row-between">
            <span id="recede-label" className="label">Recede for data</span>
            <output className="value" htmlFor="recede">{recede}</output>
          </div>
          <Slider.Root
            id="recede"
            className="slider"
            min={0}
            max={100}
            step={1}
            value={[recede]}
            onValueChange={([next]) => onRecede(next)}
            aria-labelledby="recede-label"
          >
            <Slider.Track className="slider-track">
              <Slider.Range className="slider-range" />
            </Slider.Track>
            <Slider.Thumb className="slider-thumb" aria-label="Recede for data" />
          </Slider.Root>
          <p className="hint">Above 30 points of interest hide. Above 60 labels thin to places. Labels never fade.</p>
          <label className="check">
            <input type="checkbox" checked={overlay} onChange={(event) => onOverlay(event.target.checked)} />
            <span>Show sample data overlay</span>
          </label>
        </>
      )}
    </section>
  );
}
