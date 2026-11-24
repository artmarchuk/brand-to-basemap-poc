import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialState, reducer } from '../app/appState';
import { initialBrandState } from '../app/brandState';
import { CITIES } from '../app/cities';
import { compileBrand } from '../app/compile';
import { AUTOSAVE_KEY, encodeHash, MAPTILER_KEY_STORAGE, restore, serialise } from '../app/persist';
import { getPreset } from '../presets';
import { TILE_SOURCES, withTileSource } from '../style/source';
import type { TokenName } from '../tokens/types';
import { DetailPanel } from './DetailPanel';
import { ExportPanel } from './ExportPanel';
import { MapView } from './MapView';
import { ModePanel } from './ModePanel';
import { describeFailure, describeFix, noticeToken } from './notices';
import { PresetPanel } from './PresetPanel';
import { SourcePanel } from './SourcePanel';
import { TokenPanel } from './TokenPanel';
import { ZoomBar } from './ZoomBar';

const SWEEP_MS = 12000;
const SAVE_DELAY_MS = 300;
const MODE_NAMES = { light: 'light', data: 'data' };

// Storage can be unavailable (private modes, blocked cookies); the app then just does not remember.
const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* not remembered */
    }
  },
};

export function App() {
  // A hash wins over autosave; a bad one loads the default with a notice.
  const [restored] = useState(() => restore(window.location.hash, storage.get(AUTOSAVE_KEY), initialBrandState));
  const [state, dispatch] = useReducer(reducer, restored.state, initialState);
  const [notice, setNotice] = useState(restored.notice);
  const [apiKey, setApiKey] = useState(() => storage.get(MAPTILER_KEY_STORAGE) ?? '');
  const [exportOpen, setExportOpen] = useState(false);
  const [zoom, setZoom] = useState(restored.state.view.zoom);
  const [sweeping, setSweeping] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const { brand } = state;

  // Moving the map changes only `view`; the style is compiled from everything else.
  const { primary, presetId, perPreset, mode, recede, details: detailChoices, density } = brand;
  const compiled = useMemo(
    () => compileBrand({ ...brand, view: { center: [0, 0], zoom: 0 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, presetId, perPreset, mode, recede, detailChoices, density],
  );
  const { resolved, details } = compiled;
  // MapTiler without a key stays on OpenFreeMap; the source panel asks for the key.
  const source = brand.source === 'maptiler' && apiKey ? 'maptiler' : 'openfreemap';
  const mapStyle = useMemo(() => withTileSource(compiled.style, source, apiKey), [compiled.style, source, apiKey]);

  // Share link and autosave: the same state, never the key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = encodeHash(brand);
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
      storage.set(AUTOSAVE_KEY, serialise(brand));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [brand]);

  // A different link pasted into this tab: load it.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== encodeHash(brand)) window.location.reload();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [brand]);

  const onKey = (key: string) => {
    setApiKey(key);
    storage.set(MAPTILER_KEY_STORAGE, key || null);
  };

  // Notices for the map-colour rows: every non-slot auto-fix, data-mode holds, and checks that still fail.
  const tokenNotes = useMemo(() => {
    const notes: Partial<Record<TokenName, string[]>> = {};
    const add = (token: TokenName, text: string) => (notes[token] ??= []).push(text);
    for (const fix of resolved.notices) {
      const token = noticeToken(fix);
      if (token) add(token, describeFix(fix, mode === 'data'));
    }
    resolved.finalChecks.forEach((check, index) => {
      if (check.pass) return;
      const subject = resolved.preset.checks[index].subject;
      add(subject === 'waterLabel' ? 'water' : subject, describeFailure(check));
    });
    return notes;
  }, [resolved, mode]);

  const otherTyped = Object.keys(perPreset).filter((id) => id !== presetId).map((id) => getPreset(id).name);

  const goToStop = (stop: number) => mapRef.current?.flyTo({ zoom: stop, duration: 1200 });
  const sweep = () => {
    const map = mapRef.current;
    if (!map) return;
    if (sweeping) {
      map.stop();
      return;
    }
    map.jumpTo({ zoom: 4 });
    map.easeTo({ zoom: 16, duration: SWEEP_MS, easing: (t) => t });
    setSweeping(true);
    map.once('moveend', () => setSweeping(false));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Brand-to-Basemap</h1>
        <p className="app-subtitle">Brand colours in, a map you can ship out. Prototype.</p>
        <button type="button" className="button header-export" aria-expanded={exportOpen} onClick={() => setExportOpen(!exportOpen)}>
          Export
        </button>
      </header>
      <div className="app-body">
        <aside className="panel" aria-label="Controls">
          {notice && (
            <p className="notice" role="status">
              <span>{notice}</span>
              <button type="button" className="button button-quiet" onClick={() => setNotice(undefined)}>Dismiss</button>
            </p>
          )}
          {exportOpen && <ExportPanel style={compiled.style} brand={brand} tokens={resolved.tokens} source={source} apiKey={apiKey} onClose={() => setExportOpen(false)} />}
          <PresetPanel
            preset={resolved.preset}
            slots={resolved.slots}
            notices={resolved.notices}
            dataMode={mode === 'data'}
            otherTyped={otherTyped}
            onPreset={(id) => dispatch({ type: 'preset', presetId: id })}
            onSlot={(slot, hex) => dispatch({ type: 'slot', slot, hex })}
            onClear={(slot) => dispatch({ type: 'clearSlot', slot })}
            onSample={() => dispatch({ type: 'sample' })}
            onResetPreset={() => dispatch({ type: 'resetPreset' })}
            onResetAll={() => dispatch({ type: 'resetAll' })}
          />
          <ModePanel
            mode={mode}
            recede={recede}
            onMode={(next) => dispatch({ type: 'mode', mode: next })}
            onRecede={(next) => dispatch({ type: 'recede', recede: next })}
          />
          <DetailPanel
            groups={details.groups}
            density={details.labelDensity}
            forcedOff={resolved.visibility.hidePois ? { pois: 'Hidden by data mode' } : {}}
            locked={details.locked}
            densityForced={resolved.visibility.thinMinorLabels}
            onToggle={(group, on) => dispatch({ type: 'toggleGroup', group, on })}
            onDensity={(next) => dispatch({ type: 'density', density: next })}
          />
          <TokenPanel
            tokens={resolved.tokens}
            overridden={resolved.overriddenTokens}
            modeName={MODE_NAMES[mode]}
            notes={tokenNotes}
            onOverride={(token, hex) => dispatch({ type: 'override', token, hex })}
            onReset={(token) => dispatch({ type: 'resetOverride', token })}
          />
          <SourcePanel source={brand.source} apiKey={apiKey} onSource={(next) => dispatch({ type: 'source', source: next })} onKey={onKey} />
        </aside>
        <main className="stage">
          <MapView
            style={mapStyle}
            center={restored.state.view.center}
            zoom={restored.state.view.zoom}
            logo={TILE_SOURCES[source].logo}
            onReady={(map) => (mapRef.current = map)}
            onZoom={(next) => {
              setZoom(next);
              dispatch({ type: 'viewed', zoom: next });
            }}
            onIdle={(next) => dispatch({ type: 'viewed', zoom: next })}
            onMove={(view) => dispatch({ type: 'view', view })}
          />
          <div className="stage-top">
            <label className="field">
              <span className="visually-hidden">Go to a place</span>
              <select
                className="select"
                value=""
                onChange={(event) => {
                  const city = CITIES.find((candidate) => candidate.id === event.target.value);
                  if (city) mapRef.current?.flyTo({ center: city.center, duration: 1500 });
                }}
              >
                <option value="" disabled>Go to a place…</option>
                {CITIES.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="stage-bottom">
            <ZoomBar zoom={zoom} reviewed={state.reviewed} sweeping={sweeping} onStop={goToStop} onSweep={sweep} />
          </div>
        </main>
      </div>
    </div>
  );
}
