import { useMemo, useState } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type { BrandState, SourceId } from '../app/brandState';
import { exportSnippet, exportStyle } from '../export/export';
import { exportTokensCss, exportTokensDtcg } from '../export/tokens';
import { DATA_ANCHOR_ID, TILE_SOURCES } from '../style/source';
import type { ResolvedTokens } from '../tokens/types';

interface Props {
  /** The compiled style, before the tile source is applied. */
  style: StyleSpecification;
  brand: BrandState;
  /** The resolved map tokens: the colours the map draws now. */
  tokens: ResolvedTokens;
  /** The source the map is actually on (MapTiler without a key falls back to OpenFreeMap). */
  source: SourceId;
  apiKey: string;
  onClose: () => void;
}

type Output = 'snippet' | 'style' | 'tokens' | 'css';

const OUTPUTS: Record<Output, { label: string; name: string; file: string; type: string }> = {
  snippet: { label: 'Embed snippet (HTML page)', name: 'Embed snippet', file: 'map.html', type: 'text/html' },
  style: { label: 'Style JSON (MapLibre)', name: 'Style JSON', file: 'style.json', type: 'application/json' },
  tokens: { label: 'Design tokens (DTCG JSON)', name: 'Design tokens, DTCG JSON', file: 'map.tokens.json', type: 'application/json' },
  css: { label: 'Design tokens (CSS custom properties)', name: 'Design tokens, CSS custom properties', file: 'map-tokens.css', type: 'text/css' },
};
const OUTPUT_IDS = Object.keys(OUTPUTS) as Output[];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Always available: the embed snippet, the style JSON and the map tokens for what is on the map now. */
export function ExportPanel({ style, brand, tokens, source, apiKey, onClose }: Props) {
  const [includeKey, setIncludeKey] = useState(false);
  const [copied, setCopied] = useState<Output | 'failed' | null>(null);
  const tiles = TILE_SOURCES[source];
  const key = tiles.needsKey && includeKey && apiKey ? apiKey : undefined;

  const outputs = useMemo(
    () => ({
      snippet: exportSnippet(style, brand, { source, key, center: brand.view.center, zoom: brand.view.zoom }),
      style: JSON.stringify(exportStyle(style, brand, { source, key }), null, 2),
      // The token exports take no key: there is nothing in them to put one in.
      tokens: `${JSON.stringify(exportTokensDtcg(tokens, brand, { source }), null, 2)}\n`,
      css: exportTokensCss(tokens, brand, { source }),
    }),
    [style, brand, tokens, source, key],
  );

  const onCopy = async (output: Output) => setCopied((await copy(outputs[output])) ? output : 'failed');
  const kb = (text: string) => {
    const bytes = new Blob([text]).size;
    return bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <section className="panel-section" aria-labelledby="export-heading">
      <div className="row row-between">
        <h2 id="export-heading" className="panel-heading">Export</h2>
        <button type="button" className="button button-quiet" onClick={onClose}>Close</button>
      </div>
      <>
          <p className="hint">
            What is on the map now: {brand.presetId}, {brand.mode === 'data' ? `data mode at ${brand.recede}` : 'light'}, on {tiles.name}, with attribution
            {tiles.logo ? ' and the MapTiler logo' : ''}.
          </p>
          {tiles.needsKey && (
            <div className="fieldset">
              <label className="check">
                <input type="checkbox" checked={includeKey} disabled={!apiKey} onChange={(event) => setIncludeKey(event.target.checked)} />
                Include my key
              </label>
              <p className="hint">
                {includeKey
                  ? 'Your key is written into the snippet and the style JSON, never into the tokens. Do not share them publicly, and restrict the key to your domain at cloud.maptiler.com.'
                  : 'The snippet and the style JSON contain YOUR_MAPTILER_KEY: replace it with your own key.'}
              </p>
            </div>
          )}
          {OUTPUT_IDS.map((output) => (
            <div key={output} className="fieldset">
              <div className="row row-between">
                <span className="label">{OUTPUTS[output].label}</span>
                <span className="hint">{kb(outputs[output])}</span>
              </div>
              <textarea className="export-output" readOnly value={outputs[output]} aria-label={OUTPUTS[output].name} />
              <div className="row">
                <button type="button" className="button" onClick={() => onCopy(output)}>
                  {copied === output ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => download(OUTPUTS[output].file, outputs[output], OUTPUTS[output].type)}
                >
                  Download
                </button>
              </div>
            </div>
          ))}
          {copied === 'failed' && <p className="hint" role="status">Copy failed. Select the text and copy it, or download the file.</p>}
          <p className="hint">
            Your data: add your layer with <code>beforeId: &apos;{DATA_ANCHOR_ID}&apos;</code> to draw it above land, water and roads and below the labels.
          </p>
        </>
    </section>
  );
}
