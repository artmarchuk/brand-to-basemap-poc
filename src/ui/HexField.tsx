import { useState } from 'react';
import { normalizeHex } from '../palette/brand';

interface Props {
  value: string;
  label: string;
  onCommit: (hex: string) => void;
}

/** A hex text field that commits only valid colours, so a half-typed value never reaches the map. */
export function HexField({ value, label, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !isHex(draft);
  return (
    <input
      className="hex-field"
      type="text"
      spellCheck={false}
      aria-label={label}
      aria-invalid={invalid}
      value={draft ?? value}
      onChange={(event) => {
        setDraft(event.target.value);
        if (isHex(event.target.value)) onCommit(normalizeHex(event.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function isHex(text: string) {
  try {
    normalizeHex(text);
    return true;
  } catch {
    return false;
  }
}
