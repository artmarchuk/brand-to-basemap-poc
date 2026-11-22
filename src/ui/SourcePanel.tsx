import { useState } from 'react';
import type { SourceId } from '../app/brandState';
import { TILE_SOURCES } from '../style/source';

interface Props {
  source: SourceId;
  /** The key from localStorage, or empty. */
  apiKey: string;
  onSource: (source: SourceId) => void;
  onKey: (key: string) => void;
}

/** OpenFreeMap needs nothing; MapTiler takes the user's own key, kept in this browser only. */
export function SourcePanel({ source, apiKey, onSource, onKey }: Props) {
  const [draft, setDraft] = useState('');
  return (
    <section className="panel-section" aria-labelledby="source-heading">
      <h2 id="source-heading" className="panel-heading">Tiles</h2>
      <div className="segmented" role="radiogroup" aria-labelledby="source-heading">
        {(Object.keys(TILE_SOURCES) as SourceId[]).map((id) => (
          <label key={id} className="segment">
            <input type="radio" name="source" checked={source === id} onChange={() => onSource(id)} />
            <span>{TILE_SOURCES[id].name}</span>
          </label>
        ))}
      </div>
      {source === 'maptiler' &&
        (apiKey ? (
          <div className="row row-between">
            <span className="hint">Using your MapTiler key, stored in this browser only. It is never put in links or exports unless you ask.</span>
            <button type="button" className="button button-quiet" onClick={() => onKey('')}>Forget key</button>
          </div>
        ) : (
          <form
            className="fieldset"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) onKey(draft.trim());
              setDraft('');
            }}
          >
            <label className="label" htmlFor="maptiler-key">Your MapTiler API key</label>
            <div className="row">
              <input
                id="maptiler-key"
                className="hex-field key-field"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="button">Use key</button>
            </div>
            <p className="hint">
              Get a free key at cloud.maptiler.com. It stays in this browser (localStorage) and never goes in the link. Until then the map uses
              OpenFreeMap.
            </p>
          </form>
        ))}
    </section>
  );
}
