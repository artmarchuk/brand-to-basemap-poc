import {
  createState,
  resetOverride,
  resetOverrides,
  setBrand,
  setOverride,
  type BrandInput,
  type BrandState,
} from '../palette';
import type { LabelDensity, ToggleGroup } from '../mapping/types';
import type { Mode, TokenName } from '../tokens/types';
import { ZOOM_STOPS, DEFAULT_CITY } from './cities';

/** Groups the user can switch. `core` and `labels` are always on. */
export const OPTIONAL_GROUPS: ToggleGroup[] = ['pois', 'transit', 'buildings', 'landuse', 'minorRoads', 'boundaries'];

export interface AppState {
  palette: BrandState;
  groups: ToggleGroup[];
  labelDensity: LabelDensity;
  cityId: string;
  /** Zoom stops viewed since the last style change. A reminder, not a gate. */
  reviewed: number[];
}

export type Action =
  | { type: 'brand'; brand: BrandInput }
  | { type: 'mode'; mode: Mode }
  | { type: 'recede'; recede: number }
  | { type: 'override'; token: TokenName; hex: string }
  | { type: 'resetOverride'; token: TokenName }
  | { type: 'resetOverrides' }
  | { type: 'toggleGroup'; group: ToggleGroup }
  | { type: 'density'; density: LabelDensity }
  | { type: 'city'; cityId: string }
  | { type: 'viewed'; zoom: number };

export function initialState(brand: BrandInput): AppState {
  return {
    palette: createState(brand),
    groups: ['core', 'labels'],
    labelDensity: 'low',
    cityId: DEFAULT_CITY.id,
    reviewed: [],
  };
}

/** A stop counts as viewed when the map is within this many zoom levels of it. */
const VIEWED_WITHIN = 0.3;

/** Every change to what the map looks like resets the review dots. */
const restyled = (state: AppState, change: Partial<AppState>): AppState => ({ ...state, ...change, reviewed: [] });

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'brand':
      return restyled(state, { palette: setBrand(state.palette, action.brand) });
    case 'mode':
      return restyled(state, { palette: { ...state.palette, mode: action.mode } });
    case 'recede':
      return restyled(state, { palette: { ...state.palette, recede: action.recede } });
    case 'override':
      return restyled(state, { palette: setOverride(state.palette, state.palette.mode, action.token, action.hex) });
    case 'resetOverride':
      return restyled(state, { palette: resetOverride(state.palette, state.palette.mode, action.token) });
    case 'resetOverrides':
      return restyled(state, { palette: resetOverrides(state.palette) });
    case 'toggleGroup':
      return restyled(state, {
        groups: state.groups.includes(action.group)
          ? state.groups.filter((group) => group !== action.group)
          : [...state.groups, action.group],
      });
    case 'density':
      return restyled(state, { labelDensity: action.density });
    case 'city':
      return { ...state, cityId: action.cityId };
    case 'viewed': {
      const stop = ZOOM_STOPS.find((candidate) => Math.abs(candidate - action.zoom) <= VIEWED_WITHIN);
      return stop === undefined || state.reviewed.includes(stop) ? state : { ...state, reviewed: [...state.reviewed, stop] };
    }
  }
}
