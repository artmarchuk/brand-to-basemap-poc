import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import libertyStyle from '../../base-styles/liberty.json';
import samples from '../../fixtures/palettes.json';
import { initialState, reducer } from '../app/appState';
import { CITIES, DEFAULT_CITY } from '../app/cities';
import { MAPPINGS } from '../mapping';
import { applyVisibility, resolve } from '../palette';
import { applyTokens } from '../style/applyTokens';
import { BrandPanel } from './BrandPanel';
import { DetailPanel } from './DetailPanel';
import { MapView } from './MapView';
import { ModePanel } from './ModePanel';
import { TokenPanel } from './TokenPanel';
import { ZoomBar } from './ZoomBar';

const START = samples.find((sample) => sample.name === 'Terracotta Co.') ?? samples[0];
const START_ZOOM = 12;
const SWEEP_MS = 12000;
const MODE_NAMES = { light: 'light', dark: 'dark', data: 'data' };
const base = libertyStyle as unknown as StyleSpecification;

export function App() {
  const [state, dispatch] = useReducer(reducer, { colors: START.colors, primary: START.primary }, initialState);
  const [zoom, setZoom] = useState(START_ZOOM);
  const [sweeping, setSweeping] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const { palette } = state;

  const resolved = useMemo(() => resolve(palette), [palette]);
  const { groups, labelDensity } = useMemo(
    () => applyVisibility(state.groups, state.labelDensity, resolved.visibility),
    [state.groups, state.labelDensity, resolved.visibility],
  );
  const style = useMemo(
    () => applyTokens(base, resolved.tokens, { mapping: MAPPINGS.liberty, groups, labelDensity, onWarning: () => {} }),
    [resolved.tokens, groups, labelDensity],
  );

  const city = CITIES.find((candidate) => candidate.id === state.cityId) ?? DEFAULT_CITY;
  const firstCity = useRef(city);
  useEffect(() => {
    if (city !== firstCity.current) mapRef.current?.flyTo({ center: city.center, duration: 1500 });
  }, [city]);

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
      </header>
      <div className="app-body">
        <aside className="panel" aria-label="Controls">
          <BrandPanel brand={palette.brand} onChange={(brand) => dispatch({ type: 'brand', brand })} />
          <ModePanel
            mode={palette.mode}
            recede={palette.recede}
            onMode={(mode) => dispatch({ type: 'mode', mode })}
            onRecede={(recede) => dispatch({ type: 'recede', recede })}
          />
          <DetailPanel
            groups={state.groups}
            density={state.labelDensity}
            forcedOff={resolved.visibility.hidePois ? { pois: 'Hidden by data mode' } : {}}
            densityForced={resolved.visibility.thinMinorLabels}
            onToggle={(group) => dispatch({ type: 'toggleGroup', group })}
            onDensity={(density) => dispatch({ type: 'density', density })}
          />
          <TokenPanel
            tokens={resolved.tokens}
            overridden={resolved.overriddenTokens}
            modeName={MODE_NAMES[palette.mode]}
            onOverride={(token, hex) => dispatch({ type: 'override', token, hex })}
            onReset={(token) => dispatch({ type: 'resetOverride', token })}
            onResetAll={() => dispatch({ type: 'resetOverrides' })}
          />
        </aside>
        <main className="stage">
          <MapView
            style={style}
            center={city.center}
            zoom={START_ZOOM}
            onReady={(map) => (mapRef.current = map)}
            onZoom={(next) => {
              setZoom(next);
              dispatch({ type: 'viewed', zoom: next });
            }}
            onIdle={(next) => dispatch({ type: 'viewed', zoom: next })}
          />
          <div className="stage-top">
            <label className="field">
              <span className="visually-hidden">Place</span>
              <select className="select" value={city.id} onChange={(event) => dispatch({ type: 'city', cityId: event.target.value })}>
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
