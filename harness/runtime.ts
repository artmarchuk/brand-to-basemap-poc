// Restyles a style that may not be pinned, for the harness page. Pinned styles do not use this.
import type { StyleSpecification } from 'maplibre-gl';
import { MAPPINGS } from '../src/mapping';
import { ALL_GROUPS } from '../src/mapping/types';
import { applyTokens } from '../src/style/applyTokens';
import { loadBaseStyle } from '../src/style/provider';
import type { ResolvedTokens } from '../src/tokens/types';

export async function restyleFromProvider(
  styleId: string,
  tokens: ResolvedTokens,
  key: string,
): Promise<StyleSpecification> {
  const mapping = MAPPINGS[styleId];
  const base = await loadBaseStyle(mapping, key);
  return applyTokens(base, tokens, { mapping, groups: ALL_GROUPS, labelDensity: 'high' });
}
