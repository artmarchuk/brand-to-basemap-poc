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
  halo: 'Label halo',
  accent: 'Accent',
};

interface Props {
  tokens: ResolvedTokens;
  overridden: TokenName[];
  modeName: string;
  onOverride: (token: TokenName, hex: string) => void;
  onReset: (token: TokenName) => void;
  onResetAll: () => void;
}

export function TokenPanel({ tokens, overridden, modeName, onOverride, onReset, onResetAll }: Props) {
  return (
    <section className="panel-section" aria-labelledby="tokens-heading">
      <div className="row row-between">
        <h2 id="tokens-heading" className="panel-heading">Map colours, {modeName}</h2>
        <button type="button" className="button button-quiet" onClick={onResetAll}>Reset all</button>
      </div>
      <ul className="token-list">
        {TOKEN_NAMES.map((token) => (
          <li key={token} className="token-row">
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
          </li>
        ))}
      </ul>
    </section>
  );
}
