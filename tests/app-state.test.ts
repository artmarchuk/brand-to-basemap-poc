import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action } from '../src/app/appState';
import { getPreset, presetDetails } from '../src/presets';

const start = initialState('figure-ground');

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
  ])('resets the review dots on a %s change', (_name, action) => {
    const viewed = reducer(start, { type: 'viewed', zoom: 4 });
    expect(viewed.reviewed).toEqual([4]);
    expect(reducer(viewed, action).reviewed).toEqual([]);
  });

  it('keeps the dots when only the place changes', () => {
    const viewed = reducer(start, { type: 'viewed', zoom: 4 });
    expect(reducer(viewed, { type: 'city', cityId: 'kyiv' }).reviewed).toEqual([4]);
  });

  it('switching preset keeps the primary colour and toggles the user changed, and clears overrides', () => {
    let state = reducer(start, { type: 'override', token: 'water', hex: '#00aaff' });
    state = reducer(state, { type: 'toggleGroup', group: 'pois', on: true });
    state = reducer(state, { type: 'preset', presetId: 'colour-field' });
    expect(state.palette.slots).toEqual({ field: start.palette.slots.fabric });
    expect(state.palette.overrides.light).toEqual({});
    expect(presetDetails(getPreset('colour-field'), state.detailChoices).groups).toContain('pois');
  });

  it('a locked group stays on whatever the user chose', () => {
    const state = reducer(start, { type: 'toggleGroup', group: 'buildings', on: false });
    expect(presetDetails(getPreset('figure-ground'), state.detailChoices).groups).toContain('buildings');
  });
});
