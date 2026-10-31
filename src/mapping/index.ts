import { libertyMapping } from './liberty';
import { streetsV2Mapping } from './streets-v2';
import type { StyleMapping } from './types';

export const MAPPINGS: Record<string, StyleMapping> = {
  [libertyMapping.id]: libertyMapping,
  [streetsV2Mapping.id]: streetsV2Mapping,
};
