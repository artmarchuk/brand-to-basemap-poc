import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action } from '../src/app/appState';

const start = initialState({ colors: ['#c65d3b', '#e9d8c4'], primary: 0 });

describe('app state', () => {
  it('marks a stop viewed when the map is near it, once', () => {
    let state = reducer(start, { type: 'viewed', zoom: 12.1 });
    state = reducer(state, { type: 'viewed', zoom: 11.9 });
    expect(state.reviewed).toEqual([12]);
    expect(reducer(state, { type: 'viewed', zoom: 10 }).reviewed).toEqual([12]);
  });

  it.each<[string, Action]>([
    ['brand', { type: 'brand', brand: { colors: ['#112233', '#ffeedd'], primary: 1 } }],
    ['mode', { type: 'mode', mode: 'dark' }],
    ['recede', { type: 'recede', recede: 10 }],
    ['override', { type: 'override', token: 'water', hex: '#00aaff' }],
    ['toggle', { type: 'toggleGroup', group: 'pois' }],
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

  it('overrides apply to the active mode and survive a brand change until reset', () => {
    let state = reducer(start, { type: 'override', token: 'water', hex: '#00aaff' });
    state = reducer(state, { type: 'brand', brand: { colors: ['#112233', '#ffeedd'], primary: 0 } });
    expect(state.palette.overrides.light.water).toBe('#00aaff');
    expect(reducer(state, { type: 'resetOverride', token: 'water' }).palette.overrides.light.water).toBeUndefined();
    expect(reducer(state, { type: 'resetOverrides' }).palette.overrides.light).toEqual({});
  });
});
