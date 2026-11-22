import { TOKEN_NAMES, type ResolvedTokens, type TokenName } from '../tokens/types';


const LABELS: Record<TokenName, string> = {
  land: 'Land',
  water: 'Water',
  park: 'Parks',
  roadMajor: 'Major roads',
  roadMinor: 'Minor roads',
  building: 'Buildings',
  boundary: 'Boundaries',
  labelPrimary: 'Labels, primary',
  labelSecondary: 'Labels, secondary',
  urbanLanduse: 'Built-up land',
  roadMajorCasing: 'Major road casing',
  roadHighway: 'Motorways and trunk roads',
  halo: 'Label halo',
  accent: 'Accent',
};

interface Props {
  tokens: ResolvedTokens;
  overridden: TokenName[];
  modeName: string;
  /** Auto-fix and data-mode notices, and checks that still fail, as lines per token row. */
  notes: Partial<Record<TokenName, string[]>>;
  onOverride: (token: TokenName, hex: string) => void;
  onReset: (token: TokenName) => void;
}

export function TokenPanel({ tokens, overridden, modeName, notes, onOverride, onReset }: Props) {
  return (
    <section className="panel-section" aria-labelledby="tokens-heading">
      <h2 id="tokens-heading" className="panel-heading">Map colours, {modeName}</h2>
      <p className="hint">Edits are kept per preset and mode. &quot;Reset this preset&quot; clears them.</p>
      <ul className="token-list">
        {TOKEN_NAMES.map((token) => (
          <li key={token} className="token-row colour-row-wrap">
            <input
              className="colour-input"
              type="color"
              value={tokens[token]}
              onChange={(event) => onOverride(token, event.target.value)}
              aria-label={`${LABELS[token]} colour`}
            />
            <span className="token-name">{LABELS[token]}</span>
            {overridden.includes(token) ? (
              <button type="button" className="button button-quiet" onClick={() => onReset(token)} aria-label={`Reset ${LABELS[token]} to derived`}>
                Edited · reset
              </button>
            ) : (
              <span className="hint">Derived</span>
            )}
            {notes[token]?.map((note) => (
              <span key={note} className="fix-note" role="note">{note}</span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
