import type { LabelDensity, LayerRole, ToggleGroup } from '../mapping/types';
import type { TokenName } from '../tokens/types';
import type { WeightName } from './config';

/** A key colour the user can set. Exactly one slot per preset is primary; every other has a default. */
export interface SlotDefinition {
  id: string;
  label: string;
  /** What the slot colours on the map, for the UI. */
  role: string;
  primary?: boolean;
  /** Shown up front in the app. Slots that are not exposed sit under a collapsed "Refine" group. The primary slot is always exposed. */
  exposed: boolean;
  /** Expression over earlier slots. Required on every slot that is not primary. */
  default?: string;
}

export interface RoadTreatmentDefinition {
  weight: 'base' | WeightName;
  casing: 'base' | 'none' | 'hairline';
}

/** Non-colour choices, by name. Resolved into concrete numbers for the compiler. */
export interface TreatmentDefinition {
  roadMajor: RoadTreatmentDefinition;
  roadMinor: RoadTreatmentDefinition;
  boundaryDash?: number[];
  /** Water labels: a token for the text and one for the halo. */
  waterLabel: { text: TokenName; halo: TokenName };
  accentOutline: TokenName;
  /** Built-up land fades out between these zooms. Only meaningful when the preset draws it. */
  urbanLanduseFade?: [number, number];
  /** Layer roles the preset does not draw, such as baked one-way arrows. */
  hide?: LayerRole[];
  /** Place-label halo width in pixels, when labels must read on a dark carrier. */
  labelHaloWidth?: number;
}

/**
 * Either way (the default) finds the nearest passing lightness; a direction rules the other way out.
 * `sideOf` moves towards the side of the check's first ground where that token already is, so minor
 * roads stay on the same side of the land as major roads.
 */
export type FixDirection = 'either' | 'darker' | 'lighter' | { sideOf: TokenName };

/** One way to repair a failing check. Strategies are tried in order until the check passes. */
export type FixStrategy =
  /** Move this slot's lightness by the smallest amount that passes; every token is recomputed. */
  | { slot: string; direction?: FixDirection }
  /**
   * Move this token's lightness by the smallest amount that passes. `waterLabel` means the token picked
   * for water labels, and only when that is a label token: a fix never moves a carrier through its label.
   */
  | { token: TokenName | 'waterLabel'; direction?: FixDirection }
  /** Use another token's colour for the subject. */
  | { fallback: TokenName }
  /**
   * Only for the `waterLabel` subject: the first entry that passes, else the best. An entry is a token, or
   * `text/halo`: a label colour on a halo token, which then becomes what the label sits on.
   */
  | { pick: string[] };

export interface CheckDefinition {
  id: string;
  /** `contrast` is the WCAG ratio; `distance` is OKLab distance (about 0.02 is just noticeable). */
  kind: 'contrast' | 'distance';
  /** A token, or `waterLabel` for the treatment's water label text. */
  subject: TokenName | 'waterLabel';
  /** The grounds it is measured against; it must pass on every one. */
  against: TokenName[];
  min: number;
  fix: FixStrategy[];
}

export type DetailGroup = Exclude<ToggleGroup, 'core' | 'labels'>;

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  slots: SlotDefinition[];
  /** The spec's sample palette, by slot. */
  sample: Record<string, string>;
  /** One expression per token, over the slots. */
  tokens: Record<TokenName, string>;
  treatment: TreatmentDefinition;
  detailDefaults: Record<DetailGroup, boolean> & { labelDensity: LabelDensity };
  lockedDetails: DetailGroup[];
  checks: CheckDefinition[];
}
