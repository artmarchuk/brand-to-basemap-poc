import type { LabelDensity } from '../mapping/types';
import { normalizeHex } from '../palette/brand';
import { PaletteError } from '../palette/errors';
import { normalizeOverrides, type Overrides } from '../palette/state';
import {
  DETAIL_GROUPS,
  getPreset,
  PRESET_MODES,
  PRESET_STATE_VERSION,
  PRESETS,
  primarySlot,
  type DetailGroup,
  type PresetMode,
  type PresetState,
} from '../presets';
import type { TokenName } from '../tokens/types';
import { DEFAULT_CITY } from './cities';

/**
 * Version 3: what the user made, across presets. The primary colour is global; every other value the user
 * typed is kept per preset, so switching presets loses nothing. Derived ("auto") slots are never stored:
 * they are whatever the preset's expressions give for the current primary. Plain JSON, no key.
 */
export const BRAND_STATE_VERSION = 3;

export type SourceId = 'openfreemap' | 'maptiler';
export const SOURCE_IDS: SourceId[] = ['openfreemap', 'maptiler'];

/** What one preset remembers: typed non-primary slots, and per-token overrides per mode. */
export interface PresetMemory {
  slots: Record<string, string>;
  overrides: Record<PresetMode, Overrides>;
}

export interface MapView {
  /** [longitude, latitude] */
  center: [number, number];
  zoom: number;
}

export interface BrandState {
  version: typeof BRAND_STATE_VERSION;
  primary: string;
  presetId: string;
  /** Only presets with something typed. A missing entry means "all derived". */
  perPreset: Record<string, PresetMemory>;
  mode: PresetMode;
  /** 0-100, used in data mode. */
  recede: number;
  /** Detail toggles the user changed. Everything else follows the preset's defaults. */
  details: Partial<Record<DetailGroup, boolean>>;
  density?: LabelDensity;
  /** The tile source. The MapTiler key is not part of the state. */
  source: SourceId;
  view: MapView;
}

export const START_PRESET = 'figure-ground';
export const START_VIEW: MapView = { center: DEFAULT_CITY.center, zoom: 12 };

const emptyMemory = (): PresetMemory => ({ slots: {}, overrides: { light: {}, data: {} } });
const isEmpty = (memory: PresetMemory) =>
  Object.keys(memory.slots).length === 0 && PRESET_MODES.every((mode) => Object.keys(memory.overrides[mode]).length === 0);

export const memoryOf = (state: BrandState, presetId = state.presetId): PresetMemory => state.perPreset[presetId] ?? emptyMemory();

/** Writes one preset's memory, dropping it when empty so the URL stays short. */
function withMemory(state: BrandState, presetId: string, memory: PresetMemory): BrandState {
  const perPreset = { ...state.perPreset };
  if (isEmpty(memory)) delete perPreset[presetId];
  else perPreset[presetId] = memory;
  return { ...state, perPreset };
}

/** A preset's sample palette: the sample primary, and the other sample colours typed for that preset. */
export function sampleState(presetId: string, base?: BrandState): BrandState {
  const preset = getPreset(presetId);
  const primaryId = primarySlot(preset).id;
  const slots = Object.fromEntries(
    Object.entries(preset.sample).filter(([slot]) => slot !== primaryId).map(([slot, hex]) => [slot, normalizeHex(hex)]),
  );
  const state: BrandState = base ?? {
    version: BRAND_STATE_VERSION,
    primary: '',
    presetId,
    perPreset: {},
    mode: 'light',
    recede: 60,
    details: {},
    source: 'openfreemap',
    view: START_VIEW,
  };
  return withMemory({ ...state, presetId, primary: normalizeHex(preset.sample[primaryId]) }, presetId, { ...emptyMemory(), slots });
}

export const initialBrandState = () => sampleState(START_PRESET);

/** The resolver's input for the active preset. */
export function toPresetState(state: BrandState): PresetState {
  const preset = getPreset(state.presetId);
  const memory = memoryOf(state);
  return {
    version: PRESET_STATE_VERSION,
    preset: preset.id,
    slots: { ...memory.slots, [primarySlot(preset).id]: state.primary },
    mode: state.mode,
    recede: state.recede,
    overrides: memory.overrides,
  };
}

/** Typed and derived are told apart by where the value lives: the primary and stored slots are typed. */
export function isTyped(state: BrandState, slot: string, presetId = state.presetId): boolean {
  return slot === primarySlot(getPreset(presetId)).id || slot in memoryOf(state, presetId).slots;
}

export const switchPreset = (state: BrandState, presetId: string): BrandState => ({ ...state, presetId: getPreset(presetId).id });

export const setPrimary = (state: BrandState, hex: string): BrandState => ({ ...state, primary: normalizeHex(hex) });

/** The primary slot sets the global primary; any other slot is typed for this preset only. */
export function setSlot(state: BrandState, slot: string, hex: string): BrandState {
  const preset = getPreset(state.presetId);
  if (!preset.slots.some((candidate) => candidate.id === slot)) throw new PaletteError('invalid-state', `No slot "${slot}" in ${preset.id}`);
  if (slot === primarySlot(preset).id) return setPrimary(state, hex);
  const memory = memoryOf(state);
  return withMemory(state, preset.id, { ...memory, slots: { ...memory.slots, [slot]: normalizeHex(hex) } });
}

/** Back to derived. The primary cannot be cleared. */
export function clearSlot(state: BrandState, slot: string): BrandState {
  const memory = memoryOf(state);
  if (!(slot in memory.slots)) return state;
  const slots = { ...memory.slots };
  delete slots[slot];
  return withMemory(state, state.presetId, { ...memory, slots });
}

export function setOverride(state: BrandState, token: TokenName, hex: string): BrandState {
  const memory = memoryOf(state);
  const overrides = { ...memory.overrides, [state.mode]: { ...memory.overrides[state.mode], [token]: normalizeHex(hex) } };
  return withMemory(state, state.presetId, { ...memory, overrides });
}

export function resetOverride(state: BrandState, token: TokenName): BrandState {
  const memory = memoryOf(state);
  const mode = { ...memory.overrides[state.mode] };
  delete mode[token];
  return withMemory(state, state.presetId, { ...memory, overrides: { ...memory.overrides, [state.mode]: mode } });
}

/** Clears this preset's typed slots and overrides. Keeps the primary and every other preset. */
export const resetPreset = (state: BrandState): BrandState => withMemory(state, state.presetId, emptyMemory());

/** Clears typed slots and overrides in every preset. Keeps the primary. */
export const resetAll = (state: BrandState): BrandState => ({ ...state, perPreset: {} });

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, what: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PaletteError('invalid-state', `${what} must be a number`);
  return value;
};

/**
 * Checks untrusted input (a decoded URL or autosave). Returns a clean state built field by field, so
 * anything extra, a key included, is dropped. Throws PaletteError on anything it cannot read.
 */
export function parseBrandState(raw: unknown): BrandState {
  if (!isRecord(raw)) throw new PaletteError('invalid-state', 'State must be an object');
  if (raw.version !== BRAND_STATE_VERSION) throw new PaletteError('invalid-state', `Unsupported state version: ${String(raw.version)}`);
  if (!PRESETS.some((preset) => preset.id === raw.presetId)) throw new PaletteError('invalid-state', `Unknown preset: ${String(raw.presetId)}`);
  if (!PRESET_MODES.includes(raw.mode as PresetMode)) throw new PaletteError('invalid-state', `Unknown mode: ${String(raw.mode)}`);
  if (!SOURCE_IDS.includes(raw.source as SourceId)) throw new PaletteError('invalid-state', `Unknown source: ${String(raw.source)}`);

  const perPreset: Record<string, PresetMemory> = {};
  if (!isRecord(raw.perPreset)) throw new PaletteError('invalid-state', 'perPreset must be an object');
  for (const [presetId, entry] of Object.entries(raw.perPreset)) {
    const preset = getPreset(presetId);
    if (!isRecord(entry) || !isRecord(entry.slots ?? {})) throw new PaletteError('invalid-state', `Bad memory for ${presetId}`);
    const slots: Record<string, string> = {};
    for (const [slot, hex] of Object.entries((entry.slots ?? {}) as Record<string, unknown>)) {
      const definition = preset.slots.find((candidate) => candidate.id === slot);
      if (!definition || definition.primary) throw new PaletteError('invalid-state', `No typed slot "${slot}" in ${presetId}`);
      slots[slot] = normalizeHex(hex);
    }
    const overrides = (isRecord(entry.overrides) ? entry.overrides : {}) as Record<string, unknown>;
    const memory = { slots, overrides: { light: normalizeOverrides(overrides.light ?? {}), data: normalizeOverrides(overrides.data ?? {}) } };
    if (!isEmpty(memory)) perPreset[preset.id] = memory;
  }

  const details: Partial<Record<DetailGroup, boolean>> = {};
  for (const [group, on] of Object.entries(isRecord(raw.details) ? raw.details : {})) {
    if (DETAIL_GROUPS.includes(group as DetailGroup) && typeof on === 'boolean') details[group as DetailGroup] = on;
  }
  const density = (['low', 'medium', 'high'] as const).find((candidate) => candidate === raw.density);

  const view = isRecord(raw.view) ? raw.view : {};
  const center = Array.isArray(view.center) ? view.center : [];
  return {
    version: BRAND_STATE_VERSION,
    primary: normalizeHex(raw.primary),
    presetId: raw.presetId as string,
    perPreset,
    mode: raw.mode as PresetMode,
    recede: clamp(finite(raw.recede, 'Recede'), 0, 100),
    details,
    ...(density && { density }),
    source: raw.source as SourceId,
    view: {
      center: [clamp(finite(center[0], 'Longitude'), -180, 180), clamp(finite(center[1], 'Latitude'), -85, 85)],
      zoom: clamp(finite(view.zoom, 'Zoom'), 0, 22),
    },
  };
}
