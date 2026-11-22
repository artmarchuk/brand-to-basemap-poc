import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action, type AppState } from '../src/app/appState';
import { isTyped, memoryOf, toPresetState } from '../src/app/brandState';
import { getPreset, presetDetails, PRESETS, primarySlot, resolvePreset } from '../src/presets';
import type { TokenName } from '../src/tokens/types';

const start = initialState();
const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);
const slotsOf = (state: AppState) => resolvePreset(toPresetState(state.brand)).slots;

describe('app state', () => {
  it('marks a stop viewed when the map is near it, once', () => {
    let state = reducer(start, { type: 'viewed', zoom: 12.1 });
    state = reducer(state, { type: 'viewed', zoom: 11.9 });
    expect(state.reviewed).toEqual([12]);
    expect(reducer(state, { type: 'viewed', zoom: 10 }).reviewed).toEqual([12]);
  });

  it.each<[string, Action]>([
    ['preset', { type: 'preset', presetId: 'single-ink' }],
    ['slot', { type: 'slot', slot: 'water', hex: '#112233' }],
    ['mode', { type: 'mode', mode: 'data' }],
    ['recede', { type: 'recede', recede: 10 }],
    ['override', { type: 'override', token: 'water', hex: '#00aaff' }],
    ['toggle', { type: 'toggleGroup', group: 'pois', on: true }],
    ['density', { type: 'density', density: 'high' }],
    ['source', { type: 'source', source: 'maptiler' }],
  ])('resets the review dots on a %s change', (_name, action) => {
    const viewed = reducer(start, { type: 'viewed', zoom: 4 });
    expect(viewed.reviewed).toEqual([4]);
    expect(reducer(viewed, action).reviewed).toEqual([]);
  });

  it('keeps the dots when only the view changes', () => {
    const viewed = reducer(start, { type: 'viewed', zoom: 4 });
    const moved = reducer(viewed, { type: 'view', view: { center: [30.5, 50.4], zoom: 4 } });
    expect(moved.reviewed).toEqual([4]);
    expect(moved.brand.view.center).toEqual([30.5, 50.4]);
  });

  it('the start state is the Figure-Ground sample: its colours are typed for Figure-Ground only', () => {
    expect(start.brand.presetId).toBe('figure-ground');
    expect(start.brand.primary).toBe('#e0623f');
    expect(Object.keys(start.brand.perPreset)).toEqual(['figure-ground']);
  });

  it('a locked group stays on whatever the user chose', () => {
    const state = reducer(start, { type: 'toggleGroup', group: 'buildings', on: false });
    expect(presetDetails(getPreset('figure-ground'), state.brand.details).groups).toContain('buildings');
  });

  it('switching to the same preset changes nothing', () => {
    expect(reducer(start, { type: 'preset', presetId: 'figure-ground' })).toBe(start);
  });
});

describe('colour persistence across presets', () => {
  it('switching away and back restores typed slots and overrides', () => {
    const edited = run(start, { type: 'slot', slot: 'water', hex: '#123456' }, { type: 'override', token: 'land', hex: '#fafafa' });
    const back = run(edited, { type: 'preset', presetId: 'single-ink' }, { type: 'preset', presetId: 'colour-field' }, { type: 'preset', presetId: 'figure-ground' });
    expect(back.brand.perPreset).toEqual(edited.brand.perPreset);
    expect(toPresetState(back.brand)).toEqual(toPresetState(edited.brand));
  });

  it('the primary is global: setting it in one preset sets it in every preset', () => {
    const state = run(start, { type: 'preset', presetId: 'single-ink' }, { type: 'slot', slot: 'ink', hex: '#0055aa' });
    expect(state.brand.primary).toBe('#0055aa');
    for (const preset of PRESETS) {
      const brand = { ...state.brand, presetId: preset.id };
      expect(toPresetState(brand).slots[primarySlot(preset).id]).toBe('#0055aa');
    }
  });

  it('derived slots follow the primary; typed slots do not', () => {
    // Figure-Ground's sample types paper and water; green is derived (= paper).
    const typed = run(start, { type: 'slot', slot: 'fabric', hex: '#2255cc' });
    const slots = Object.fromEntries(slotsOf(typed).map((slot) => [slot.id, slot]));
    expect(slots.water).toMatchObject({ source: 'user', input: '#7fbdb0' });
    expect(isTyped(typed.brand, 'water')).toBe(true);
    // Clear water: it is derived again, so it now follows the new primary.
    const cleared = reducer(typed, { type: 'clearSlot', slot: 'water' });
    const water = slotsOf(cleared).find((slot) => slot.id === 'water')!;
    expect(water.source).toBe('default');
    const other = slotsOf(run(cleared, { type: 'slot', slot: 'fabric', hex: '#cc5522' })).find((slot) => slot.id === 'water')!;
    expect(other.input).not.toBe(water.input);
    expect(isTyped(cleared.brand, 'water')).toBe(false);
  });

  it('a preset never visited derives everything from the current primary', () => {
    const state = run(start, { type: 'slot', slot: 'fabric', hex: '#2255cc' }, { type: 'preset', presetId: 'colour-field' });
    expect(slotsOf(state).filter((slot) => slot.source === 'user').map((slot) => slot.id)).toEqual(['field']);
    expect(memoryOf(state.brand).slots).toEqual({});
  });

  it('"Reset this preset" clears its typed slots and overrides, keeps the primary and other presets', () => {
    const state = run(
      start,
      { type: 'override', token: 'land', hex: '#fafafa' },
      { type: 'preset', presetId: 'single-ink' },
      { type: 'slot', slot: 'paper', hex: '#fffff0' },
      { type: 'slot', slot: 'ink', hex: '#223344' },
      { type: 'resetPreset' },
    );
    expect(state.brand.primary).toBe('#223344');
    expect(state.brand.perPreset['single-ink']).toBeUndefined();
    expect(state.brand.perPreset['figure-ground'].overrides.light).toEqual({ land: '#fafafa' });
  });

  it('"Reset all" clears every preset and keeps the primary', () => {
    const state = run(start, { type: 'preset', presetId: 'single-ink' }, { type: 'slot', slot: 'paper', hex: '#fffff0' }, { type: 'resetAll' });
    expect(state.brand.perPreset).toEqual({});
    expect(state.brand.primary).toBe(start.brand.primary);
  });

  it('the sample palette sets the primary and types the sample colours for this preset only', () => {
    const state = run(start, { type: 'preset', presetId: 'colour-field' }, { type: 'sample' });
    expect(state.brand.primary).toBe('#f59aae');
    expect(memoryOf(state.brand).slots).toEqual({ deep: '#ea4a3c', ink: '#3f1a8c', spark: '#ffe600' });
    expect(state.brand.perPreset['figure-ground']).toEqual(start.brand.perPreset['figure-ground']);
  });

  // Property: under any sequence of edits and switches, each preset keeps exactly what was last typed in it.
  it('random edits and switches never lose a typed value (property test)', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
    const hex = () => `#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}`;
    const tokens: TokenName[] = ['land', 'water', 'roadMajor', 'labelPrimary'];

    for (let trial = 0; trial < 40; trial++) {
      let state = start;
      // The model: what each preset should hold, tracked independently of the reducer.
      const model: Record<string, { slots: Record<string, string>; overrides: Record<string, Record<string, string>> }> = {};
      for (const [id, memory] of Object.entries(start.brand.perPreset)) model[id] = structuredClone(memory);
      let primary = start.brand.primary;

      for (let step = 0; step < 60; step++) {
        const preset = getPreset(state.brand.presetId);
        const entry = (model[preset.id] ??= { slots: {}, overrides: { light: {}, data: {} } });
        const roll = random();
        let action: Action;
        if (roll < 0.3) action = { type: 'preset', presetId: pick(PRESETS).id };
        else if (roll < 0.5) {
          const slot = pick(preset.slots);
          action = { type: 'slot', slot: slot.id, hex: hex() };
          if (slot.primary) primary = action.hex;
          else entry.slots[slot.id] = action.hex;
        } else if (roll < 0.6) {
          const slot = pick(preset.slots);
          action = { type: 'clearSlot', slot: slot.id };
          delete entry.slots[slot.id];
        } else if (roll < 0.75) {
          action = { type: 'override', token: pick(tokens), hex: hex() };
          entry.overrides[state.brand.mode][action.token] = action.hex;
        } else if (roll < 0.85) {
          action = { type: 'resetOverride', token: pick(tokens) };
          delete entry.overrides[state.brand.mode][action.token];
        } else if (roll < 0.95) action = { type: 'mode', mode: pick(['light', 'data'] as const) };
        else action = { type: 'view', view: { center: [random() * 10, 45 + random()], zoom: random() * 16 } };
        state = reducer(state, action);
      }

      expect(state.brand.primary).toBe(primary);
      for (const preset of PRESETS) {
        const expected = model[preset.id] ?? { slots: {}, overrides: { light: {}, data: {} } };
        const memory = memoryOf(state.brand, preset.id);
        expect(memory.slots).toEqual(expected.slots);
        expect(memory.overrides).toEqual(expected.overrides);
      }
    }
  });
});
