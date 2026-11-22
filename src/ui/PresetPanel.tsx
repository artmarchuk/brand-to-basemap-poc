import { PRESETS, type FixNotice, type PresetDefinition, type SlotResult } from '../presets';
import { HexField } from './HexField';
import { describeFix } from './notices';

interface Props {
  preset: PresetDefinition;
  slots: SlotResult[];
  notices: FixNotice[];
  /** Presets other than this one that hold typed colours, by name. */
  otherTyped: string[];
  onPreset: (id: string) => void;
  onSlot: (slot: string, hex: string) => void;
  onClear: (slot: string) => void;
  onSample: () => void;
  onResetPreset: () => void;
  onResetAll: () => void;
}

const thumbnail = (id: string) => `${import.meta.env.BASE_URL}thumbs/${id}.png`;

/** Proof of concept: preset first (static thumbnails), then the primary colour, then optional "refine" slots. */
export function PresetPanel({ preset, slots, notices, otherTyped, onPreset, onSlot, onClear, onSample, onResetPreset, onResetAll }: Props) {
  const fixOf = (id: string) => notices.find((notice) => notice.kind === 'slot' && notice.target === id);
  const row = (definition: PresetDefinition['slots'][number]) => {
    const slot = slots.find((candidate) => candidate.id === definition.id)!;
    const fix = fixOf(slot.id);
    const auto = slot.source === 'default';
    return (
      <li key={slot.id} className="colour-row colour-row-wrap">
        <input className="colour-input" type="color" value={slot.input} onChange={(event) => onSlot(slot.id, event.target.value)} aria-label={definition.label} />
        <HexField value={slot.input} label={`${definition.label} hex`} onCommit={(hex) => onSlot(slot.id, hex)} />
        <span className="token-name">
          {definition.label}{' '}
          {definition.primary ? <span className="tag">all presets</span> : auto ? <span className="tag">auto</span> : <span className="tag">typed</span>}
          <span className="hint">{definition.role}</span>
        </span>
        {!definition.primary && !auto && (
          <button type="button" className="button button-quiet" onClick={() => onClear(slot.id)} aria-label={`Set ${definition.label} back to auto`}>
            Auto
          </button>
        )}
        {fix && (
          <span className="fix-note" role="note">
            used: {slot.used}. {describeFix(fix)}
          </span>
        )}
      </li>
    );
  };
  const refine = preset.slots.filter((slot) => !slot.exposed);
  const refineFixed = refine.filter((slot) => fixOf(slot.id)).length;
  return (
    <section className="panel-section" aria-labelledby="preset-heading">
      <h2 id="preset-heading" className="panel-heading">Preset</h2>
      <div className="preset-grid" role="radiogroup" aria-labelledby="preset-heading">
        {PRESETS.map((item) => (
          <label key={item.id} className="preset-card">
            <input type="radio" name="preset" checked={preset.id === item.id} onChange={() => onPreset(item.id)} />
            <img className="preset-thumb" src={thumbnail(item.id)} alt="" />
            <span>{item.name}</span>
          </label>
        ))}
      </div>
      <p className="hint">{preset.description}</p>
      <h3 className="panel-subheading">Colours</h3>
      <p className="hint">The primary colour is shared by every preset. Colours you type are kept per preset; auto colours follow the primary.</p>
      <ul className="colour-list">{preset.slots.filter((slot) => slot.exposed).map(row)}</ul>
      {refine.length > 0 && (
        <details className="refine" open={refineFixed > 0 || undefined}>
          <summary>
            Refine ({refine.map((slot) => slot.label).join(', ')}){refineFixed > 0 && ` · ${refineFixed} auto-fixed`}
          </summary>
          <p className="hint">Every colour here has an auto value, derived from the others, until you type one.</p>
          <ul className="colour-list">{refine.map(row)}</ul>
        </details>
      )}
      <div className="row row-wrap">
        <button type="button" className="button" onClick={onSample}>Use this preset&apos;s sample palette</button>
        <button type="button" className="button" onClick={onResetPreset}>Reset this preset</button>
        <button type="button" className="button" onClick={onResetAll}>Reset all presets</button>
      </div>
      <p className="hint">
        Reset clears typed colours and edited map colours back to auto. It keeps the primary.
        {otherTyped.length > 0 && ` Also typed: ${otherTyped.join(', ')}.`}
      </p>
    </section>
  );
}
