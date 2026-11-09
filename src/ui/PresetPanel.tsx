import { PRESETS, type FixNotice, type PresetDefinition, type SlotResult } from '../presets';
import { HexField } from './HexField';

interface Props {
  preset: PresetDefinition;
  slots: SlotResult[];
  notices: FixNotice[];
  onPreset: (id: string) => void;
  onSlot: (slot: string, hex: string) => void;
  onClear: (slot: string) => void;
  onSample: () => void;
}

const thumbnail = (id: string) => `${import.meta.env.BASE_URL}thumbs/${id}.png`;

/** Proof of concept: preset first (static thumbnails), then the primary colour, then optional "refine" slots. */
export function PresetPanel({ preset, slots, notices, onPreset, onSlot, onClear, onSample }: Props) {
  const row = (definition: PresetDefinition['slots'][number]) => {
    const slot = slots.find((candidate) => candidate.id === definition.id)!;
    const fix = notices.find((notice) => notice.kind === 'slot' && notice.target === slot.id);
    return (
      <li key={slot.id} className="colour-row">
        <input className="colour-input" type="color" value={slot.input} onChange={(event) => onSlot(slot.id, event.target.value)} aria-label={definition.label} />
        <HexField value={slot.input} label={`${definition.label} hex`} onCommit={(hex) => onSlot(slot.id, hex)} />
        <span className="token-name">
          {definition.label}
          <span className="hint">{definition.primary ? 'Required' : slot.source === 'default' ? 'Derived default' : definition.role}</span>
        </span>
        {!definition.primary && slot.source === 'user' && (
          <button type="button" className="button button-quiet" onClick={() => onClear(slot.id)} aria-label={`Use the derived default for ${definition.label}`}>
            Default
          </button>
        )}
        {slot.used !== slot.input && <span className="hint" title={fix?.check}>used: {slot.used}</span>}
      </li>
    );
  };
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
      <h3 className="panel-subheading">Key colour</h3>
      <ul className="colour-list">{preset.slots.filter((slot) => slot.primary).map(row)}</ul>
      <h3 className="panel-subheading">Refine</h3>
      <p className="hint">Optional. Each starts as a colour derived from the key colour.</p>
      <ul className="colour-list">{preset.slots.filter((slot) => !slot.primary).map(row)}</ul>
      <button type="button" className="button" onClick={onSample}>Use this preset&apos;s sample palette</button>
    </section>
  );
}
