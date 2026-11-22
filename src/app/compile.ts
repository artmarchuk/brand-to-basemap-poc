import type { StyleSpecification } from 'maplibre-gl';
import libertyStyle from '../../base-styles/liberty.json';
import { MAPPINGS } from '../mapping';
import { applyVisibility } from '../palette';
import { presetDetails, resolvePreset, type PresetResolved } from '../presets';
import { applyTokens } from '../style/applyTokens';
import { addDataAnchor } from '../style/source';
import { toPresetState, type BrandState } from './brandState';

const base = libertyStyle as unknown as StyleSpecification;

export interface Compiled {
  resolved: PresetResolved;
  details: ReturnType<typeof presetDetails>;
  /** The full style with the data anchor, still pointing at Liberty's own (OpenFreeMap) sources. */
  style: StyleSpecification;
}

/** BrandState to a MapLibre style. Pure: the app, the exports and the scripts all use this. */
export function compileBrand(brand: BrandState): Compiled {
  const resolved = resolvePreset(toPresetState(brand));
  const details = presetDetails(resolved.preset, brand.details, brand.density);
  const { groups, labelDensity } = applyVisibility(details.groups, details.labelDensity, resolved.visibility);
  const style = applyTokens(base, resolved.tokens, {
    mapping: MAPPINGS.liberty,
    groups,
    labelDensity,
    treatment: resolved.treatment,
    onWarning: () => {},
  });
  return { resolved, details, style: addDataAnchor(style) };
}
