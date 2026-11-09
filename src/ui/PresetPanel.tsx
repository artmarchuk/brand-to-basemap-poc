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

/** Proof of concept: preset first, then its named slots. Phase 2 designs the real picker and thumbnails. */
export function PresetPanel({ preset, slots, notices, onPreset, onSlot, onClear, onSample }: Props) {
  return (
    <section className="panel-section" aria-labelledby="preset-heading">
      <h2 id="preset-heading" className="panel-heading">Preset</h2>
      <div className="segmented" role="radiogroup" aria-labelledby="preset-heading">
        {PRESETS.map((item) => (
          <label key={item.id} className="segment">
            <input type="radio" name="preset" checked={preset.id === item.id} onChange={() => onPreset(item.id)} />
            <span>{item.name}</span>
          </label>
        ))}
      </div>
      <p className="hint">{preset.description}</p>
      <ul className="colour-list">
        {preset.slots.map((definition) => {
          const slot = slots.find((candidate) => candidate.id === definition.id)!;
          const moved = slot.used !== slot.input;
          const fix = notices.find((notice) => notice.kind === 'slot' && notice.target === slot.id);
          return (
            <li key={slot.id} className="colour-row">
              <input
                className="colour-input"
                type="color"
                value={slot.input}
                onChange={(event) => onSlot(slot.id, event.target.value)}
                aria-label={definition.label}
              />
              <HexField value={slot.input} label={`${definition.label} hex`} onCommit={(hex) => onSlot(slot.id, hex)} />
              <span className="token-name">
                {definition.label}
                {definition.primary ? ' (primary)' : slot.source === 'default' ? ' · default' : ''}
              </span>
              {!definition.primary && slot.source === 'user' && (
                <button type="button" className="button button-quiet" onClick={() => onClear(slot.id)} aria-label={`Use the default ${definition.label}`}>
                  Default
                </button>
              )}
              {moved && <span className="hint" title={fix?.check}>used: {slot.used}</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="button" onClick={onSample}>Use the sample palette</button>
    </section>
  );
}
