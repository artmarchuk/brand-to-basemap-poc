import { casing, rail, text, tint, tunnel, waterLabel } from './shared';
import type { MappingRule, StyleMapping } from './types';

const transport = { sourceLayer: 'transportation', type: 'line' };
const ROAD_WHY = 'Casings and tunnels have no token; they follow their road so hierarchy holds.';

function roadRules(idPattern: RegExp, road: 'roadMajor' | 'roadMinor', group: 'core' | 'minorRoads'): MappingRule[] {
  return [
    { match: { ...transport, idPattern: new RegExp(`${idPattern.source}.*_casing$`) }, group, colors: { 'line-color': casing(road) }, why: ROAD_WHY },
    { match: { ...transport, idPattern: new RegExp(`^tunnel_.*${idPattern.source}`) }, group, colors: { 'line-color': tunnel(road) }, why: ROAD_WHY },
    { match: { ...transport, idPattern }, group, colors: { 'line-color': road } },
  ];
}

export const libertyMapping: StyleMapping = {
  id: 'liberty',
  name: 'OpenFreeMap Liberty',
  provider: { id: 'openfreemap' },
  rules: [
    { match: { type: 'background' }, group: 'core', colors: { 'background-color': 'background' } },
    {
      match: { type: 'raster' },
      hidden: true,
      why: 'Shaded-relief imagery has baked colours that no token can reach.',
    },

    // Parks and green landcover
    { match: { sourceLayer: 'park', type: 'fill' }, group: 'core', colors: { 'fill-color': 'park', 'fill-outline-color': 'park' } },
    { match: { sourceLayer: 'park', type: 'line' }, group: 'core', colors: { 'line-color': tint('park', 'labelPrimary', 0.2) }, why: 'Park outline is a slightly stronger park.' },
    { match: { sourceLayer: 'landcover', classes: ['wood', 'grass'] }, group: 'core', colors: { 'fill-color': 'park' } },
    {
      match: { sourceLayer: 'landcover', classes: ['wetland'] },
      group: 'core',
      replacePattern: true,
      colors: { 'fill-color': tint('park', 'water', 0.35) },
      why: 'The base draws wetland with a sprite pattern; it becomes a park-to-water tint.',
    },
    { match: { sourceLayer: 'landcover', classes: ['ice'] }, group: 'core', colors: { 'fill-color': tint('land', 'water', 0.25) }, why: 'No ice token; land leaning to water.' },
    { match: { sourceLayer: 'landcover', classes: ['sand'] }, group: 'core', colors: { 'fill-color': tint('land', 'labelSecondary', 0.08) }, why: 'No sand token; a faint land tint.' },

    // Land use
    { match: { sourceLayer: 'landuse', classes: ['residential'] }, group: 'landuse', colors: { 'fill-color': 'land' } },
    { match: { sourceLayer: 'landuse', classes: ['pitch', 'track', 'cemetery'] }, group: 'landuse', colors: { 'fill-color': 'park', 'fill-outline-color': 'park' } },
    { match: { sourceLayer: 'landuse', classes: ['hospital', 'school'] }, group: 'landuse', colors: { 'fill-color': tint('land', 'labelSecondary', 0.08) }, why: 'Institutional land has no token; a faint land tint.' },

    // Water
    { match: { sourceLayer: 'waterway', type: 'line', idPattern: /tunnel/ }, group: 'core', colors: { 'line-color': tint('water', 'land', 0.4) }, why: 'Culverted water recedes towards land.' },
    { match: { sourceLayer: ['water', 'waterway'], type: ['fill', 'line'] }, group: 'core', colors: { 'fill-color': 'water', 'line-color': 'water' } },

    // Airports
    { match: { sourceLayer: 'aeroway', type: 'fill' }, group: 'transit', colors: { 'fill-color': tint('land', 'roadMinor', 0.4) }, why: 'Airport grounds have no token; between land and minor road.' },
    { match: { sourceLayer: 'aeroway', type: 'line' }, group: 'transit', colors: { 'line-color': tint('roadMinor', 'land', 0.2) }, why: 'Runways read as a quieter minor road.' },

    // Rail: matched before roads because tunnel_ and bridge_ prefixes overlap
    { match: { ...transport, idPattern: /_rail(_hatching)?$/ }, group: 'transit', colors: { 'line-color': rail }, why: 'No rail token; a neutral between land and secondary label.' },

    // Roads. Secondary and tertiary share layers in Liberty, so tertiary reads as major here.
    ...roadRules(/(motorway|trunk_primary|secondary_tertiary|link)/, 'roadMajor', 'core'),
    ...roadRules(/(service_track|street|minor|path_pedestrian)/, 'roadMinor', 'minorRoads'),
    {
      match: { sourceLayer: 'transportation', type: 'fill' },
      group: 'minorRoads',
      replacePattern: true,
      colors: { 'fill-color': tint('roadMinor', 'land', 0.5) },
      why: 'The base draws pedestrian areas with a sprite pattern; it becomes a quiet minor-road tint.',
    },
    { match: { sourceLayer: 'transportation', type: 'symbol' }, group: 'minorRoads', bakedSprite: true },

    // Buildings and boundaries
    { match: { sourceLayer: 'building', type: 'fill' }, group: 'buildings', colors: { 'fill-color': 'building', 'fill-outline-color': tint('building', 'labelPrimary', 0.15) }, why: 'Outline is a slightly stronger building.' },
    { match: { sourceLayer: 'building', type: 'fill-extrusion' }, group: 'buildings', colors: { 'fill-extrusion-color': 'building' } },
    { match: { sourceLayer: 'boundary' }, group: 'boundaries', colors: { 'line-color': 'boundary' } },

    // Water names
    { match: { sourceLayer: 'water_name' }, group: 'labels', density: 'low', colors: text(waterLabel), why: 'Water names sit on water, so they derive from it.' },
    { match: { sourceLayer: 'waterway', type: 'symbol' }, group: 'labels', density: 'medium', colors: text(waterLabel), why: 'Water names sit on water, so they derive from it.' },

    // POIs and transit stops: the accent reaches text only, Liberty's icons are baked
    { match: { ids: ['poi_transit', 'airport'] }, group: 'transit', colors: text('accent'), bakedSprite: true },
    { match: { sourceLayer: 'poi' }, group: 'pois', colors: text('accent'), bakedSprite: true },

    // Road names and shields
    { match: { ids: ['highway-name-major'] }, group: 'labels', density: 'medium', colors: text('labelPrimary') },
    { match: { ids: ['highway-name-minor', 'highway-name-path'] }, group: 'labels', density: 'high', colors: text('labelSecondary') },
    {
      // Shield text keeps MapLibre's default black: it sits on a baked light sprite, not the map.
      match: { idPattern: /shield/ },
      group: 'labels',
      density: 'medium',
      bakedSprite: true,
      filterGuard: ['has', 'ref_length'],
    },

    // Places
    { match: { ids: ['label_other', 'label_village'] }, group: 'labels', density: 'medium', colors: text('labelSecondary') },
    { match: { ids: ['label_state'] }, group: 'labels', density: 'low', colors: text('labelSecondary') },
    { match: { sourceLayer: 'place' }, group: 'labels', density: 'low', colors: text('labelPrimary') },
  ],
};
