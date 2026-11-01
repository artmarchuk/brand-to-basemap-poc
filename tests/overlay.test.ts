import { describe, expect, it } from 'vitest';
import { buildOverlay, withOverlay, type Bounds } from '../harness/overlay';
import { deriveTokens } from '../src/palette';
import type { StyleSpecification } from 'maplibre-gl';

const zurich: Bounds = { west: 8.4, south: 47.3, east: 8.7, north: 47.45 };

describe('demo overlay', () => {
  it('is deterministic', () => {
    expect(buildOverlay(zurich)).toEqual(buildOverlay(zurich));
  });

  it('covers the view with a bounded number of cells and values in 0-1', () => {
    const { hexes, points } = buildOverlay(zurich);
    expect(hexes.features.length).toBeGreaterThan(20);
    expect(hexes.features.length).toBeLessThan(900);
    expect(points.features.length).toBeGreaterThan(0);
    for (const { properties } of hexes.features) expect(properties.value).toBeGreaterThanOrEqual(0);
    for (const { properties } of hexes.features) expect(properties.value).toBeLessThanOrEqual(1);
  });

  it('keeps the same cells for a small pan', () => {
    const panned = { ...zurich, west: zurich.west + 0.001, east: zurich.east + 0.001 };
    const key = (feature: { geometry: { coordinates: number[][][] } }) => feature.geometry.coordinates[0][0].join();
    const first = new Map(buildOverlay(zurich).hexes.features.map((f) => [key(f), f.properties.value]));
    const shared = buildOverlay(panned).hexes.features.filter((f) => first.has(key(f)));
    expect(shared.length).toBeGreaterThan(20);
    for (const f of shared) expect(first.get(key(f))).toBe(f.properties.value);
  });

  it('stays bounded for a continent-sized view and a tiny one', () => {
    for (const b of [{ west: -30, south: 30, east: 50, north: 70 }, { west: 179.9, south: -1.3, east: 180, north: -1.2 }]) {
      const { hexes } = buildOverlay(b);
      expect(hexes.features.length).toBeLessThan(900);
    }
  });

  it('puts the hexagons under the roads, the points under the labels, and leaves the base layers alone', () => {
    const base = {
      version: 8,
      sources: {},
      layers: [{ id: 'bg', type: 'background' }, { id: 'road', type: 'line', source: 's' }, { id: 'label', type: 'symbol', source: 's' }],
    } as unknown as StyleSpecification;
    const tokens = deriveTokens({ colors: ['#336699', '#f0f0f0'], primary: 0 });
    const style = withOverlay(base, buildOverlay(zurich), tokens);
    expect(style.layers.map((l) => l.id)).toEqual(['bg', 'demo-hexes', 'road', 'demo-points', 'label']);
    expect(base.layers).toHaveLength(3);
  });
});
