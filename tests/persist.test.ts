import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action } from '../src/app/appState';
import { initialBrandState, parseBrandState } from '../src/app/brandState';
import { decodeHash, encodeHash, restore, serialise } from '../src/app/persist';

const edited = (
  [
    { type: 'preset', presetId: 'single-ink' },
    { type: 'slot', slot: 'paper', hex: '#fff8e7' },
    { type: 'slot', slot: 'ink', hex: '#1a3a6b' },
    { type: 'override', token: 'water', hex: '#bcd4e6' },
    { type: 'mode', mode: 'data' },
    { type: 'recede', recede: 72 },
    { type: 'toggleGroup', group: 'pois', on: true },
    { type: 'density', density: 'medium' },
    { type: 'source', source: 'maptiler' },
    { type: 'view', view: { center: [30.5234, 50.4501], zoom: 13.25 } },
  ] as Action[]
).reduce(reducer, initialState()).brand;

describe('share link and autosave', () => {
  it('the hash round-trips the full state', () => {
    expect(decodeHash(encodeHash(edited))).toEqual(edited);
  });

  it('autosave round-trips the same state', () => {
    expect(restore('', serialise(edited), initialBrandState)).toEqual({ state: edited, from: 'autosave' });
  });

  it('a hash wins over autosave', () => {
    const other = { ...edited, primary: '#000000' };
    expect(restore(encodeHash(other), serialise(edited), initialBrandState).state.primary).toBe('#000000');
  });

  it('no hash and no autosave gives the default, quietly', () => {
    expect(restore('', null, initialBrandState)).toEqual({ state: initialBrandState(), from: 'default' });
  });

  it.each([
    ['not ours', '#zoom=4'],
    ['not base64 JSON', '#s=!!!notjson'],
    ['an old version', encodeHash({ ...edited, version: 2 } as never)],
    ['an unknown preset', encodeHash({ ...edited, presetId: 'neon' })],
    ['a bad colour', encodeHash({ ...edited, primary: 'blue-ish' })],
    ['a bad view', encodeHash({ ...edited, view: { center: ['a', 1], zoom: 3 } } as never)],
  ])('a hash that is %s loads the default with a notice, never throws', (_name, hash) => {
    const result = restore(hash, serialise(edited), initialBrandState);
    expect(result.from).toBe('default');
    expect(result.state).toEqual(initialBrandState());
    expect(result.notice).toMatch(/could not be opened/);
  });

  it('a damaged autosave loads the default with a notice', () => {
    expect(restore('', '{"version":3', initialBrandState).notice).toMatch(/could not be restored/);
  });

  it('never carries a key: unknown fields, a key among them, are dropped on parse', () => {
    const key = 'abcdefghijklmnopqrstuvwx';
    const withKey = { ...edited, key, maptilerKey: key, perPreset: { ...edited.perPreset } };
    const parsed = parseBrandState(JSON.parse(JSON.stringify(withKey)));
    expect(parsed).toEqual(edited);
    expect(encodeHash(parsed)).not.toContain(key);
    expect(atob(encodeHash(parsed).slice(3).replaceAll('-', '+').replaceAll('_', '/'))).not.toContain('key');
  });

  it('clamps out-of-range numbers instead of failing', () => {
    const parsed = parseBrandState({ ...JSON.parse(serialise(edited)), recede: 400, view: { center: [500, 89], zoom: 40 } });
    expect(parsed.recede).toBe(100);
    expect(parsed.view).toEqual({ center: [180, 85], zoom: 22 });
  });

  it('keeps the URL short', () => {
    expect(encodeHash(edited).length).toBeLessThan(600);
  });
});
