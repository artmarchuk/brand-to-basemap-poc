import samples from '../../fixtures/palettes.json';
import { MAX_COLORS, MIN_COLORS } from '../palette/brand';
import type { BrandInput } from '../palette';
import { makeColor, parseColor } from '../tokens/color';
import { HexField } from './HexField';

interface Props {
  brand: BrandInput;
  onChange: (brand: BrandInput) => void;
}

/** A new colour: the primary's hue turned a third of the way round for each colour already there. */
function nextColour(brand: BrandInput) {
  const primary = parseColor(brand.colors[brand.primary])!;
  return makeColor(0.6, Math.max(primary.c, 0.08), primary.h + 120 * (brand.colors.length - 1));
}

export function BrandPanel({ brand, onChange }: Props) {
  const setColour = (index: number, hex: string) => onChange({ ...brand, colors: brand.colors.map((c, i) => (i === index ? hex : c)) });
  const remove = (index: number) =>
    onChange({
      colors: brand.colors.filter((_, i) => i !== index),
      primary: index < brand.primary ? brand.primary - 1 : index === brand.primary ? 0 : brand.primary,
    });

  return (
    <section className="panel-section" aria-labelledby="brand-heading">
      <h2 id="brand-heading" className="panel-heading">Brand colours</h2>
      <ul className="colour-list">
        {brand.colors.map((hex, index) => (
          <li key={index} className="colour-row">
            <input
              type="radio"
              name="primary"
              checked={brand.primary === index}
              onChange={() => onChange({ ...brand, primary: index })}
              aria-label={`Colour ${index + 1} is the primary colour`}
            />
            <input
              className="colour-input"
              type="color"
              value={hex}
              onChange={(event) => setColour(index, event.target.value)}
              aria-label={`Colour ${index + 1}`}
            />
            <HexField value={hex} label={`Colour ${index + 1} hex`} onCommit={(next) => setColour(index, next)} />
            <button
              type="button"
              className="button button-quiet"
              onClick={() => remove(index)}
              disabled={brand.colors.length <= MIN_COLORS}
              aria-label={`Remove colour ${index + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">The selected dot marks the primary colour. Use {MIN_COLORS} to {MAX_COLORS} colours.</p>
      <div className="row">
        <button
          type="button"
          className="button"
          disabled={brand.colors.length >= MAX_COLORS}
          onClick={() => onChange({ ...brand, colors: [...brand.colors, nextColour(brand)] })}
        >
          Add colour
        </button>
        <label className="field">
          <span className="visually-hidden">Sample palette</span>
          <select
            className="select"
            value=""
            onChange={(event) => {
              const sample = samples[Number(event.target.value)];
              if (sample) onChange({ colors: sample.colors, primary: sample.primary });
            }}
          >
            <option value="">Try a sample palette</option>
            {samples.map((sample, index) => (
              <option key={sample.name} value={index}>{sample.name}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
