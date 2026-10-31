import type { StyleSpecification } from 'maplibre-gl';
import type { StyleMapping } from '../mapping/types';
import type { ResolvedTokens } from '../tokens/types';
import { applyTokens } from './applyTokens';
import type { StyleWarning } from './fallback';
import { expandLayers } from './split';

export interface DriftReport {
  /** What applyTokens had to fall back on. Any of these needs a mapping update. */
  warnings: StyleWarning[];
  /** IDs named by the mapping that the live style no longer has. */
  staleIds: string[];
  /** Differences from the local pinned copy. Informational: rules may already cover them. */
  added: string[];
  removed: string[];
}

export function detectDrift(
  live: StyleSpecification,
  mapping: StyleMapping,
  tokens: ResolvedTokens,
  pinned?: StyleSpecification,
): DriftReport {
  const warnings: StyleWarning[] = [];
  applyTokens(live, tokens, { mapping, onWarning: (warning) => warnings.push(warning) });

  const liveIds = new Set(expandLayers(live.layers, mapping, () => {}).map((layer) => layer.id));
  const staleIds = mapping.rules.flatMap((rule) => rule.match.ids ?? []).filter((id) => !liveIds.has(id));

  const pinnedIds = new Set(pinned?.layers.map((layer) => layer.id));
  const baseIds = new Set(live.layers.map((layer) => layer.id));
  return {
    warnings,
    staleIds,
    added: pinned ? [...baseIds].filter((id) => !pinnedIds.has(id)) : [],
    removed: [...pinnedIds].filter((id) => !baseIds.has(id)),
  };
}

export const hasDrift = ({ warnings, staleIds }: DriftReport) => warnings.length > 0 || staleIds.length > 0;
