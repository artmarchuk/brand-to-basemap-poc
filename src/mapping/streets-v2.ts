import { casing, rail, text, tint, tunnel, waterLabel } from './shared';
import type { ColorRef, ColorSpec, StyleMapping } from './types';

// Streets filters lean on legacy negations (`!in class ...`), so class rules are fragile on
// transportation layers. Those use explicit IDs; land and water use source-layer rules.
const ROAD_WHY = 'Casings and tunnels have no token; they follow their road so hierarchy holds.';

// `match` branches in order: motorway, trunk and primary, everything else.
const byRoadClass = (major: ColorRef, minor: ColorRef) => ({ stops: [major, major, minor] });

const poi: Record<string, ColorSpec> = {
  'text-color': 'accent',
  'text-halo-color': 'halo',
  'icon-color': 'accent',
  'icon-halo-color': 'halo',
};

const place = (color: ColorRef): Record<string, ColorSpec> => ({
  ...text(color),
  'icon-color': 'halo',
  'icon-halo-color': color,
});

const shield = {
  ...text('labelSecondary'),
  'icon-color': 'halo',
  'icon-halo-color': 'labelSecondary',
} as const;

export const streetsV2Mapping: StyleMapping = {
  id: 'streets-v2',
  name: 'MapTiler Streets v2',
  provider: { id: 'maptiler', keyHost: 'api.maptiler.com' },
  rules: [
    { match: { type: 'background' }, group: 'core', colors: { 'background-color': 'background' } },

    // Green land cover. Crop is farmland, so it leans to land.
    { match: { ids: ['Crop'] }, group: 'core', colors: { 'fill-color': tint('park', 'land', 0.5) }, why: 'Farmland is not a park; halfway between park and land.' },
    { match: { sourceLayer: ['landcover', 'globallandcover'], classes: ['grass', 'scrub', 'forest', 'wood'] }, group: 'core', colors: { 'fill-color': 'park' } },
    { match: { sourceLayer: 'landcover', classes: ['ice'] }, group: 'core', colors: { 'fill-color': tint('land', 'water', 0.25) }, why: 'No ice token; land leaning to water.' },
    { match: { sourceLayer: 'landcover', classes: ['sand'] }, group: 'core', colors: { 'fill-color': tint('land', 'labelSecondary', 0.08) }, why: 'No sand token; a faint land tint.' },

    // Land use
    { match: { ids: ['Residential'] }, group: 'landuse', colors: { 'fill-color': 'land' } },
    { match: { ids: ['Cemetery', 'Stadium'] }, group: 'landuse', colors: { 'fill-color': 'park' } },
    { match: { ids: ['Industrial', 'Hospital', 'School'] }, group: 'landuse', colors: { 'fill-color': tint('land', 'labelSecondary', 0.08) }, why: 'Institutional and industrial land have no token; a faint land tint.' },

    // Water
    { match: { ids: ['River tunnel'] }, group: 'core', colors: { 'line-color': tint('water', 'land', 0.4) }, why: 'Culverted water recedes towards land.' },
    { match: { ids: ['Aqueduct outline'] }, group: 'core', colors: { 'line-color': tint('water', 'labelPrimary', 0.25) }, why: 'Aqueduct casing, a stronger water.' },
    { match: { ids: ['Water intermittent'] }, group: 'core', colors: { 'fill-color': tint('water', 'land', 0.4) }, why: 'Intermittent water sits between water and land.' },
    { match: { sourceLayer: ['water', 'waterway'], type: ['fill', 'line'] }, group: 'core', colors: { 'fill-color': 'water', 'line-color': 'water' } },

    // Airports
    { match: { sourceLayer: 'aeroway', type: 'fill' }, group: 'transit', colors: { 'fill-color': tint('land', 'roadMinor', 0.4) }, why: 'Airport grounds have no token; between land and minor road.' },
    { match: { sourceLayer: 'aeroway', type: 'line' }, group: 'transit', colors: { 'line-color': tint('roadMinor', 'land', 0.2) }, why: 'Runways read as a quieter minor road.' },

    // Rail, ferries and cable cars
    { match: { ids: ['Ferry line'] }, group: 'transit', colors: { 'line-color': tint('water', 'labelPrimary', 0.4) }, why: 'Ferry routes must stand out on water.' },
    { match: { idPattern: /rail|Railway|Cablecar/i, type: 'line' }, group: 'transit', colors: { 'line-color': rail }, why: 'No rail token; a neutral between land and secondary label.' },

    // Roads. "Minor road" also carries secondary and tertiary in this style.
    { match: { ids: ['Highway outline', 'Major road outline', 'Bridge outline'] }, group: 'core', colors: { 'line-color': casing('roadMajor') }, why: ROAD_WHY },
    { match: { ids: ['Highway', 'Major road'] }, group: 'core', colors: { 'line-color': 'roadMajor' } },
    { match: { ids: ['Tunnel outline'] }, group: 'core', colors: { 'line-color': byRoadClass(casing('roadMajor'), casing('roadMinor')) }, why: ROAD_WHY },
    { match: { ids: ['Tunnel'] }, group: 'core', colors: { 'line-color': byRoadClass(tunnel('roadMajor'), tunnel('roadMinor')) }, why: ROAD_WHY },
    { match: { ids: ['Road under construction'] }, group: 'minorRoads', colors: { 'line-color': byRoadClass(tunnel('roadMajor'), tunnel('roadMinor')) }, why: 'Roads under construction read as unfinished roads.' },
    { match: { ids: ['Minor road outline', 'Path outline', 'Footway tunnel outline'] }, group: 'minorRoads', colors: { 'line-color': casing('roadMinor') }, why: ROAD_WHY },
    { match: { ids: ['Footway tunnel'] }, group: 'minorRoads', colors: { 'line-color': tunnel('roadMinor') }, why: ROAD_WHY },
    { match: { ids: ['Minor road', 'Path minor', 'Path'] }, group: 'minorRoads', colors: { 'line-color': 'roadMinor' } },
    { match: { ids: ['Pedestrian', 'Bridge', 'Pier', 'Pier road'] }, group: 'minorRoads', colors: { 'fill-color': tint('roadMinor', 'land', 0.5), 'line-color': tint('roadMinor', 'land', 0.5) }, why: 'Paved areas and piers are a quiet minor-road tint.' },

    // Buildings and boundaries
    { match: { sourceLayer: 'building', type: 'fill' }, group: 'buildings', colors: { 'fill-color': 'building', 'fill-outline-color': tint('building', 'labelPrimary', 0.15) }, why: 'Outline is a slightly stronger building.' },
    { match: { sourceLayer: 'building', type: 'fill-extrusion' }, group: 'buildings', colors: { 'fill-extrusion-color': 'building' } },
    { match: { sourceLayer: 'boundary' }, group: 'boundaries', colors: { 'line-color': 'boundary' } },

    // Water names
    { match: { ids: ['Ocean labels', 'Lake labels'] }, group: 'labels', density: 'low', colors: text(waterLabel), why: 'Water names sit on water, so they derive from it.' },
    { match: { ids: ['River labels'] }, group: 'labels', density: 'medium', colors: text(waterLabel), why: 'Water names sit on water, so they derive from it.' },

    // Road symbols
    { match: { ids: ['Housenumber'] }, group: 'labels', density: 'high', colors: text('labelSecondary') },
    { match: { ids: ['Road labels'] }, group: 'labels', density: 'medium', colors: { ...text('labelSecondary'), 'icon-color': 'labelSecondary' } },
    { match: { ids: ['Oneway'] }, group: 'minorRoads', colors: { 'icon-color': tint('roadMinor', 'labelPrimary', 0.4) }, why: 'Arrows sit on the road, so they follow it.' },
    { match: { ids: ['Highway junction', 'Highway shield', 'Highway shield (US)', 'Highway shield interstate (US)'] }, group: 'labels', density: 'medium', colors: shield },
    { match: { ids: ['Highway shield interstate top (US)'] }, group: 'labels', density: 'medium', colors: poi },

    // Transit symbols
    { match: { ids: ['Gondola', 'Ferry', 'Airport gate'] }, group: 'transit', colors: text('labelSecondary') },
    { match: { ids: ['Station', 'Airport'] }, group: 'transit', colors: poi },

    // POIs: the accent reaches both icon and text, Streets' icons are SDF
    { match: { sourceLayer: 'poi' }, group: 'pois', colors: poi },

    // Places
    { match: { ids: ['Place labels'] }, group: 'labels', density: 'medium', colors: place('labelSecondary') },
    { match: { ids: ['State labels'] }, group: 'labels', density: 'low', colors: place('labelSecondary') },
    { match: { sourceLayer: 'place' }, group: 'labels', density: 'low', colors: place('labelPrimary') },
  ],
};
