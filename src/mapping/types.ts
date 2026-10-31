import type { TokenName } from '../tokens/types';

export type ToggleGroup =
  | 'core'
  | 'pois'
  | 'transit'
  | 'buildings'
  | 'landuse'
  | 'minorRoads'
  | 'boundaries'
  | 'labels';

export const ALL_GROUPS: ToggleGroup[] = ['core', 'pois', 'transit', 'buildings', 'landuse', 'minorRoads', 'boundaries', 'labels'];

export type LabelDensity = 'low' | 'medium' | 'high';

/** A colour taken from one token, optionally moved towards another token. */
export type ColorRef = TokenName | { token: TokenName; mix: { with: TokenName; amount: number } };

/**
 * How one colour property is rewritten. A plain ref keeps the original's ramp as lightness
 * offsets around the ref. `stops` assigns one ref per colour in expression order, for
 * expressions whose branches belong to different tokens.
 */
export type ColorSpec = ColorRef | { stops: ColorRef[] };

export interface LayerMatch {
  /** Explicit layer IDs: the fallback where a rule would be fragile. */
  ids?: string[];
  type?: string | string[];
  sourceLayer?: string | string[];
  /** Matches when the layer's filter positively selects one of these `class` values. */
  classes?: string[];
  idPattern?: RegExp;
}

export interface MappingRule {
  match: LayerMatch;
  /** Hidden by design: the layer is removed from the output. Needs `why`. */
  hidden?: boolean;
  group?: ToggleGroup;
  /** Only for the `labels` group: the lowest density that shows this layer. */
  density?: LabelDensity;
  colors?: Record<string, ColorSpec>;
  /** Draws the layer as an opaque flat fill, so it shows the token exactly. Fill-extrusions become fills. */
  flatten?: boolean;
  /** Replaces a sprite fill pattern with the colours in `colors`. */
  replacePattern?: boolean;
  /** Prepended to an `all` filter, for features the base style's filter does not guard. */
  filterGuard?: unknown[];
  /** The layer also draws baked sprite colours that tokens cannot reach. */
  bakedSprite?: boolean;
  /** Required on derived and hidden layers; goes into the report. */
  why?: string;
}

/** Divides a base layer whose features belong to different tokens or groups. */
export interface LayerSplit {
  layerId: string;
  /** ID of the new layer, which takes these classes and sits directly above the original. */
  newId: string;
  classes: string[];
}

export interface StyleMapping {
  id: string;
  name: string;
  provider: {
    id: string;
    /** Requests to this host need the user's key. Absent when the provider needs none. */
    keyHost?: string;
    /** Fetched at runtime with the user's key. Absent when the style is pinned in the repo. */
    styleUrl?: string;
  };
  /** Run before the rules, which then see the new layers like any others. */
  splits?: LayerSplit[];
  /** First matching rule wins. Every layer in the base style must match one. */
  rules: MappingRule[];
}
