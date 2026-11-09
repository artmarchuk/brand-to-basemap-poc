import { OPTIONAL_GROUPS } from '../app/appState';
import type { LabelDensity, ToggleGroup } from '../mapping/types';
import type { DetailGroup } from '../presets';

const GROUP_LABELS: Record<string, string> = {
  pois: 'Points of interest',
  transit: 'Transit',
  buildings: 'Buildings',
  landuse: 'Land use',
  minorRoads: 'Minor roads below z14',
  boundaries: 'Boundaries',
};

const DENSITIES: LabelDensity[] = ['low', 'medium', 'high'];

interface Props {
  groups: ToggleGroup[];
  density: LabelDensity;
  /** Groups the current mode switches off, with the reason. */
  forcedOff: Partial<Record<ToggleGroup, string>>;
  /** Groups the preset keeps on. Shown checked and disabled, not hidden. */
  locked: DetailGroup[];
  densityForced: boolean;
  onToggle: (group: DetailGroup, on: boolean) => void;
  onDensity: (density: LabelDensity) => void;
}

export function DetailPanel({ groups, density, forcedOff, locked, densityForced, onToggle, onDensity }: Props) {
  return (
    <section className="panel-section" aria-labelledby="detail-heading">
      <h2 id="detail-heading" className="panel-heading">Add detail</h2>
      <p className="hint">Each preset sets its own starting detail.</p>
      <ul className="check-list">
        {OPTIONAL_GROUPS.map((group) => (
          <li key={group}>
            <label className="check">
              <input
                type="checkbox"
                checked={groups.includes(group) && !forcedOff[group]}
                disabled={Boolean(forcedOff[group]) || locked.includes(group)}
                onChange={(event) => onToggle(group, event.target.checked)}
              />
              <span>{GROUP_LABELS[group]}</span>
              {forcedOff[group] && <span className="hint">{forcedOff[group]}</span>}
              {locked.includes(group) && <span className="hint">Part of this preset</span>}
            </label>
          </li>
        ))}
      </ul>
      <fieldset className="fieldset" disabled={densityForced}>
        <legend className="label">Label density</legend>
        <div className="segmented">
          {DENSITIES.map((item) => (
            <label key={item} className="segment">
              <input type="radio" name="density" checked={density === item} onChange={() => onDensity(item)} />
              <span>{item[0].toUpperCase() + item.slice(1)}</span>
            </label>
          ))}
        </div>
        {densityForced && <p className="hint">Data mode thins labels to places above 60.</p>}
      </fieldset>
    </section>
  );
}
