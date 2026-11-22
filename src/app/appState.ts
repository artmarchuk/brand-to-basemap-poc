import type { LabelDensity, ToggleGroup } from '../mapping/types';
import type { DetailGroup, PresetMode } from '../presets';
import type { TokenName } from '../tokens/types';
import {
  clearSlot,
  initialBrandState,
  resetAll,
  resetOverride,
  resetPreset,
  sampleState,
  setOverride,
  setSlot,
  switchPreset,
  type BrandState,
  type MapView,
  type SourceId,
} from './brandState';
import { ZOOM_STOPS } from './cities';

/** Groups the user can switch. `core` and `labels` are always on; `urbanLanduse` belongs to the preset. */
export const OPTIONAL_GROUPS: DetailGroup[] = ['pois', 'transit', 'buildings', 'landuse', 'minorRoads', 'boundaries'];

export interface AppState {
  /** Everything that is shared and autosaved. */
  brand: BrandState;
  /** Zoom stops viewed since the last style change. A reminder, not a gate. Not saved. */
  reviewed: number[];
}

export type Action =
  | { type: 'preset'; presetId: string }
  | { type: 'sample' }
  | { type: 'slot'; slot: string; hex: string }
  | { type: 'clearSlot'; slot: string }
  | { type: 'mode'; mode: PresetMode }
  | { type: 'recede'; recede: number }
  | { type: 'override'; token: TokenName; hex: string }
  | { type: 'resetOverride'; token: TokenName }
  | { type: 'resetPreset' }
  | { type: 'resetAll' }
  | { type: 'toggleGroup'; group: DetailGroup; on: boolean }
  | { type: 'density'; density: LabelDensity }
  | { type: 'source'; source: SourceId }
  | { type: 'view'; view: MapView }
  | { type: 'viewed'; zoom: number };

export const initialState = (brand: BrandState = initialBrandState()): AppState => ({ brand, reviewed: [] });

/** A stop counts as viewed when the map is within this many zoom levels of it. */
const VIEWED_WITHIN = 0.3;

/** Every change to what the map looks like resets the review dots. */
const restyled = (state: AppState, brand: BrandState): AppState => (brand === state.brand ? state : { brand, reviewed: [] });

export function reducer(state: AppState, action: Action): AppState {
  const { brand } = state;
  switch (action.type) {
    case 'preset':
      return action.presetId === brand.presetId ? state : restyled(state, switchPreset(brand, action.presetId));
    case 'sample':
      return restyled(state, sampleState(brand.presetId, brand));
    case 'slot':
      return restyled(state, setSlot(brand, action.slot, action.hex));
    case 'clearSlot':
      return restyled(state, clearSlot(brand, action.slot));
    case 'mode':
      return restyled(state, { ...brand, mode: action.mode });
    case 'recede':
      return restyled(state, { ...brand, recede: action.recede });
    case 'override':
      return restyled(state, setOverride(brand, action.token, action.hex));
    case 'resetOverride':
      return restyled(state, resetOverride(brand, action.token));
    case 'resetPreset':
      return restyled(state, resetPreset(brand));
    case 'resetAll':
      return restyled(state, resetAll(brand));
    case 'toggleGroup':
      return restyled(state, { ...brand, details: { ...brand.details, [action.group]: action.on } });
    case 'density':
      return restyled(state, { ...brand, density: action.density });
    case 'source':
      return restyled(state, { ...brand, source: action.source });
    case 'view':
      return { ...state, brand: { ...brand, view: action.view } };
    case 'viewed': {
      const stop = ZOOM_STOPS.find((candidate) => Math.abs(candidate - action.zoom) <= VIEWED_WITHIN);
      return stop === undefined || state.reviewed.includes(stop) ? state : { ...state, reviewed: [...state.reviewed, stop] };
    }
  }
}

export type { ToggleGroup };
