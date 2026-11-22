import { useMemo, useState } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type { BrandState, SourceId } from '../app/brandState';
import { exportSnippet, exportStyle } from '../export/export';
import { DATA_ANCHOR_ID, TILE_SOURCES } from '../style/source';

interface Props {
  /** The compiled style, before the tile source is applied. */
  style: StyleSpecification;
  brand: BrandState;
  /** The source the map is actually on (MapTiler without a key falls back to OpenFreeMap). */
  source: SourceId;
  apiKey: string;
  onClose: () => void;
}

type Output = 'snippet' | 'style';

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

/** Always available: the embed snippet and the style JSON for what is on the map now. */
export function ExportPanel({ style, brand, source, apiKey, onClose }: Props) {
  const [includeKey, setIncludeKey] = useState(false);
  const [copied, setCopied] = useState<Output | 'failed' | null>(null);
  const tiles = TILE_SOURCES[source];
  const key = tiles.needsKey && includeKey && apiKey ? apiKey : undefined;

  const outputs = useMemo(
    () => ({
      snippet: exportSnippet(style, brand, { source, key, center: brand.view.center, zoom: brand.view.zoom }),
      style: JSON.stringify(exportStyle(style, brand, { source, key }), null, 2),
    }),
    [style, brand, source, key],
  );

  const onCopy = async (output: Output) => setCopied((await copy(outputs[output])) ? output : 'failed');
  const kb = (text: string) => `${Math.round(new Blob([text]).size / 1024)} KB`;

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
                  ? 'Your key is written into both files. Do not share them publicly, and restrict the key to your domain at cloud.maptiler.com.'
                  : 'The files contain YOUR_MAPTILER_KEY: replace it with your own key.'}
              </p>
            </div>
          )}
          {(['snippet', 'style'] as Output[]).map((output) => (
            <div key={output} className="fieldset">
              <div className="row row-between">
                <span className="label">{output === 'snippet' ? 'Embed snippet (HTML page)' : 'Style JSON (MapLibre)'}</span>
                <span className="hint">{kb(outputs[output])}</span>
              </div>
              <textarea className="export-output" readOnly value={outputs[output]} aria-label={output === 'snippet' ? 'Embed snippet' : 'Style JSON'} />
              <div className="row">
                <button type="button" className="button" onClick={() => onCopy(output)}>
                  {copied === output ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => download(output === 'snippet' ? 'map.html' : 'style.json', outputs[output], output === 'snippet' ? 'text/html' : 'application/json')}
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
