import { BUILDING_WHY, buildingColors, casing, rail, text, tint, tunnel, waterLabel } from './shared';
import type { ColorRef, ColorSpec, StyleMapping } from './types';

// Streets filters lean on legacy negations (`!in class ...`), so class rules are fragile on
// transportation layers. Those use explicit IDs; land and water use source-layer rules.
const ROAD_WHY = 'Casings and tunnels have no token; they follow their road so hierarchy holds.';

const MAJOR_CLASSES = ['motorway', 'trunk', 'primary', 'secondary'];

// `match` branches in order: motorway, trunk and primary, everything else.
const byRoadClass = (major: ColorRef, minor: ColorRef) => ({ stops: [major, major, minor] });
const allBranches = (color: ColorRef) => byRoadClass(color, color);

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
  provider: {
    id: 'maptiler',
    keyHost: 'api.maptiler.com',
    styleUrl: 'https://api.maptiler.com/maps/streets-v2/style.json',
  },
  // The token line sits between secondary and tertiary, but these layers straddle it.
  splits: [
    { layerId: 'Minor road outline', newId: 'Minor road outline (secondary)', classes: ['secondary'] },
    { layerId: 'Minor road', newId: 'Minor road (secondary)', classes: ['secondary'] },
    { layerId: 'Tunnel outline', newId: 'Tunnel outline (major)', classes: MAJOR_CLASSES },
    { layerId: 'Tunnel', newId: 'Tunnel (major)', classes: MAJOR_CLASSES },
  ],
  rules: [
    { match: { type: 'background' }, group: 'core', colors: { 'background-color': 'land' } },

    // Green land cover. Global cover paints most of a continent at low zoom, so full park would flood it.
    { match: { sourceLayer: 'globallandcover' }, group: 'core', colors: { 'fill-color': tint('park', 'land', 0.5) }, why: 'Broad low-zoom cover, halfway to land so it does not flood the map.' },
    { match: { sourceLayer: 'landcover', classes: ['grass', 'wood'] }, group: 'core', colors: { 'fill-color': 'park' } },
    { match: { sourceLayer: 'landcover', classes: ['ice'] }, group: 'core', colors: { 'fill-color': tint('land', 'water', 0.25) }, why: 'No ice token; land leaning to water.' },
    { match: { sourceLayer: 'landcover', classes: ['sand'] }, group: 'core', colors: { 'fill-color': tint('land', 'labelSecondary', 0.08) }, why: 'No sand token; a faint land tint.' },

    // Land use
    { match: { ids: ['Residential'] }, group: 'landuse', colors: { 'fill-color': tint('land', 'labelSecondary', 0.05) }, why: 'Built-up land is the canvas with a faint tint.' },
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

    // Roads
    { match: { ids: ['Highway outline', 'Major road outline', 'Bridge outline', 'Minor road outline (secondary)'] }, group: 'core', colors: { 'line-color': casing('roadMajor') }, why: ROAD_WHY },
    { match: { ids: ['Highway', 'Major road', 'Minor road (secondary)'] }, group: 'core', colors: { 'line-color': 'roadMajor' } },
    { match: { ids: ['Tunnel outline (major)'] }, group: 'core', colors: { 'line-color': allBranches(casing('roadMajor')) }, why: ROAD_WHY },
    { match: { ids: ['Tunnel (major)'] }, group: 'core', colors: { 'line-color': allBranches(tunnel('roadMajor')) }, why: ROAD_WHY },
    { match: { ids: ['Tunnel outline'] }, group: 'minorRoads', colors: { 'line-color': allBranches(casing('roadMinor')) }, why: ROAD_WHY },
    { match: { ids: ['Tunnel'] }, group: 'minorRoads', colors: { 'line-color': allBranches(tunnel('roadMinor')) }, why: ROAD_WHY },
    { match: { ids: ['Road under construction'] }, group: 'minorRoads', colors: { 'line-color': byRoadClass(tunnel('roadMajor'), tunnel('roadMinor')) }, why: 'Roads under construction read as unfinished roads.' },
    { match: { ids: ['Minor road outline', 'Path outline', 'Footway tunnel outline'] }, group: 'minorRoads', colors: { 'line-color': casing('roadMinor') }, why: ROAD_WHY },
    { match: { ids: ['Footway tunnel'] }, group: 'minorRoads', colors: { 'line-color': tunnel('roadMinor') }, why: ROAD_WHY },
    { match: { ids: ['Minor road', 'Path minor', 'Path'] }, group: 'minorRoads', colors: { 'line-color': 'roadMinor' } },
    { match: { ids: ['Pedestrian', 'Bridge', 'Pier', 'Pier road'] }, group: 'minorRoads', colors: { 'fill-color': tint('roadMinor', 'land', 0.5), 'line-color': tint('roadMinor', 'land', 0.5) }, why: 'Paved areas and piers are a quiet minor-road tint.' },

    // Buildings and boundaries
    { match: { sourceLayer: 'building' }, group: 'buildings', flatten: true, colors: buildingColors, why: BUILDING_WHY },
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
