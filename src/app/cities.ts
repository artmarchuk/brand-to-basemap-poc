export interface City {
  id: string;
  name: string;
  /** [longitude, latitude] */
  center: [number, number];
}

/** Curated places with different street patterns and label scripts. The map can also be panned anywhere. */
export const CITIES: City[] = [
  { id: 'zurich', name: 'Zurich', center: [8.5417, 47.3769] },
  { id: 'kyiv', name: 'Kyiv', center: [30.5234, 50.4501] },
  { id: 'lisbon', name: 'Lisbon', center: [-9.1393, 38.7223] },
  { id: 'new-york', name: 'New York', center: [-74.006, 40.7128] },
  { id: 'tokyo', name: 'Tokyo', center: [139.6917, 35.6895] },
  { id: 'nairobi', name: 'Nairobi', center: [36.8219, -1.2921] },
];

export const DEFAULT_CITY = CITIES[0];

/** Zoom stops: about z4 (region), z8 (metro), z12 (city), z16 (streets). */
export const ZOOM_STOPS = [4, 8, 12, 16] as const;
