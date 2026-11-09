import type { LabelDensity, ToggleGroup } from '../mapping/types';
import {
  clearSlot,
  getPreset,
  resetPresetOverride,
  resetPresetOverrides,
  samplePresetState,
  setPresetOverride,
  setSlot,
  switchPreset,
  type DetailGroup,
  type PresetMode,
  type PresetState,
} from '../presets';
import type { TokenName } from '../tokens/types';
import { DEFAULT_CITY, ZOOM_STOPS } from './cities';

/** Groups the user can switch. `core` and `labels` are always on; `urbanLanduse` belongs to the preset. */
export const OPTIONAL_GROUPS: DetailGroup[] = ['pois', 'transit', 'buildings', 'landuse', 'minorRoads', 'boundaries'];

export interface AppState {
  palette: PresetState;
  /** Toggles the user changed. Everything else follows the preset's defaults; locked groups ignore these. */
  detailChoices: Partial<Record<DetailGroup, boolean>>;
  densityChoice?: LabelDensity;
  cityId: string;
  /** Zoom stops viewed since the last style change. A reminder, not a gate. */
  reviewed: number[];
  /** What a preset switch replaced, so one click can bring it back. Cleared by the next edit. */
  undo?: { palette: PresetState; fromName: string; hadOverrides: boolean };
}

export type Action =
  | { type: 'preset'; presetId: string }
  | { type: 'undoPreset' }
  | { type: 'sample' }
  | { type: 'slot'; slot: string; hex: string }
  | { type: 'clearSlot'; slot: string }
  | { type: 'mode'; mode: PresetMode }
  | { type: 'recede'; recede: number }
  | { type: 'override'; token: TokenName; hex: string }
  | { type: 'resetOverride'; token: TokenName }
  | { type: 'resetOverrides' }
  | { type: 'toggleGroup'; group: DetailGroup; on: boolean }
  | { type: 'density'; density: LabelDensity }
  | { type: 'city'; cityId: string }
  | { type: 'viewed'; zoom: number };

export function initialState(presetId: string): AppState {
  return { palette: samplePresetState(presetId), detailChoices: {}, cityId: DEFAULT_CITY.id, reviewed: [] };
}

/** A stop counts as viewed when the map is within this many zoom levels of it. */
const VIEWED_WITHIN = 0.3;

/** Every change to what the map looks like resets the review dots. */
const restyled = (state: AppState, change: Partial<AppState>): AppState => ({ ...state, ...change, reviewed: [] });

const hasOverrides = (palette: PresetState) => Object.values(palette.overrides).some((set) => Object.keys(set).length > 0);

export function reducer(state: AppState, action: Action): AppState {
  const next = step(state, action);
  // Only a preset switch offers an undo; the next real edit retires it. Moving the map does not.
  if (action.type === 'preset' || action.type === 'undoPreset' || action.type === 'city' || action.type === 'viewed') return next;
  return next.undo ? { ...next, undo: undefined } : next;
}

function step(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'preset': {
      if (action.presetId === state.palette.preset) return state;
      // Keeps the primary colour and the toggles the user changed; clears overrides (see switchPreset).
      const fromName = getPreset(state.palette.preset).name;
      return restyled(state, {
        palette: switchPreset(state.palette, action.presetId),
        undo: { palette: state.palette, fromName, hadOverrides: hasOverrides(state.palette) },
      });
    }
    case 'undoPreset':
      return state.undo ? restyled(state, { palette: state.undo.palette, undo: undefined }) : state;
    case 'sample':
      return restyled(state, { palette: { ...samplePresetState(state.palette.preset), mode: state.palette.mode, recede: state.palette.recede } });
    case 'slot':
      return restyled(state, { palette: setSlot(state.palette, action.slot, action.hex) });
    case 'clearSlot':
      return restyled(state, { palette: clearSlot(state.palette, action.slot) });
    case 'mode':
      return restyled(state, { palette: { ...state.palette, mode: action.mode } });
    case 'recede':
      return restyled(state, { palette: { ...state.palette, recede: action.recede } });
    case 'override':
      return restyled(state, { palette: setPresetOverride(state.palette, action.token, action.hex) });
    case 'resetOverride':
      return restyled(state, { palette: resetPresetOverride(state.palette, action.token) });
    case 'resetOverrides':
      return restyled(state, { palette: resetPresetOverrides(state.palette) });
    case 'toggleGroup':
      return restyled(state, { detailChoices: { ...state.detailChoices, [action.group]: action.on } });
    case 'density':
      return restyled(state, { densityChoice: action.density });
    case 'city':
      return { ...state, cityId: action.cityId };
    case 'viewed': {
      const stop = ZOOM_STOPS.find((candidate) => Math.abs(candidate - action.zoom) <= VIEWED_WITHIN);
      return stop === undefined || state.reviewed.includes(stop) ? state : { ...state, reviewed: [...state.reviewed, stop] };
    }
  }
}

export type { ToggleGroup };
