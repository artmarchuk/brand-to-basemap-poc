import colourField from '../../presets/colour-field.json';
import figureGround from '../../presets/figure-ground.json';
import singleInk from '../../presets/single-ink.json';
import { ALL_GROUPS } from '../mapping/types';
import { TOKEN_NAMES, type TokenName } from '../tokens/types';
import { PRESET_CONFIG } from './config';
import { parseExpression, references } from './expr';
import type { DetailGroup, PresetDefinition } from './types';

export class PresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetError';
  }
}

export const DETAIL_GROUPS = ALL_GROUPS.filter((group) => group !== 'core' && group !== 'labels') as DetailGroup[];

/**
 * Checks a preset file's shape and every expression in it, so a broken file fails at load with its name,
 * not later as a wrong colour. Returns the same object, typed.
 */
export function validatePreset(raw: unknown): PresetDefinition {
  const preset = raw as PresetDefinition;
  const fail = (message: string): never => {
    throw new PresetError(`Preset "${preset?.id ?? '?'}": ${message}`);
  };
  if (!preset || typeof preset.id !== 'string' || typeof preset.name !== 'string') fail('needs an id and a name');
  if (!Array.isArray(preset.slots) || preset.slots.length === 0) fail('needs slots');
  const primaries = preset.slots.filter((slot) => slot.primary);
  if (primaries.length !== 1) fail(`needs exactly one primary slot, has ${primaries.length}`);

  const known: string[] = [];
  for (const slot of preset.slots) {
    if (!slot.primary) {
      if (!slot.default) fail(`slot "${slot.id}" is not primary, so it needs a default`);
      const unknown = references(parseExpression(slot.default!)).filter((name) => !known.includes(name));
      if (unknown.length) fail(`default of "${slot.id}" reads ${unknown.join(', ')}, which is not an earlier slot`);
    }
    known.push(slot.id);
  }
  for (const token of TOKEN_NAMES) {
    const source = preset.tokens?.[token];
    if (!source) fail(`no expression for token "${token}"`);
    const unknown = references(parseExpression(source)).filter((name) => !known.includes(name));
    if (unknown.length) fail(`token "${token}" reads ${unknown.join(', ')}, which is not a slot`);
  }
  const extra = Object.keys(preset.tokens).filter((token) => !(TOKEN_NAMES as readonly string[]).includes(token));
  if (extra.length) fail(`unknown tokens ${extra.join(', ')}`);

  const isToken = (name: unknown) => (TOKEN_NAMES as readonly unknown[]).includes(name);
  const { treatment } = preset;
  for (const road of [treatment?.roadMajor, treatment?.roadMinor]) {
    if (!road || !['base', ...Object.keys(PRESET_CONFIG.weights)].includes(road.weight)) fail('road weight must be base or a configured weight');
    if (!['base', 'none', 'hairline'].includes(road.casing)) fail('road casing must be base, none or hairline');
  }
  if (!isToken(treatment.waterLabel?.text) || !isToken(treatment.waterLabel?.halo)) fail('water label text and halo must be tokens');
  if (!isToken(treatment.accentOutline)) fail('accent outline must be a token');
  const ROLES = ['roadMajor', 'roadMajorCasing', 'roadMinor', 'roadMinorCasing', 'boundary', 'waterLabel', 'poi', 'urbanLanduse', 'roadArea', 'oneWay'];
  for (const role of treatment.hide ?? []) if (!ROLES.includes(role)) fail(`cannot hide unknown role "${role}"`);

  for (const group of DETAIL_GROUPS) if (typeof preset.detailDefaults?.[group] !== 'boolean') fail(`detail default for "${group}" must be true or false`);
  for (const group of preset.lockedDetails ?? []) if (!DETAIL_GROUPS.includes(group)) fail(`cannot lock "${group}"`);

  for (const check of preset.checks ?? []) {
    if (!['contrast', 'distance'].includes(check.kind)) fail(`check "${check.id}" has an unknown kind`);
    if (check.subject !== 'waterLabel' && !isToken(check.subject)) fail(`check "${check.id}" has an unknown subject`);
    if (!check.against?.length || !check.against.every(isToken)) fail(`check "${check.id}" must name the tokens it is measured against`);
    if (typeof check.min !== 'number') fail(`check "${check.id}" needs a number min`);
    for (const strategy of check.fix ?? []) {
      if ('direction' in strategy) {
        const direction = strategy.direction!;
        const valid = typeof direction === 'string' ? ['either', 'darker', 'lighter'].includes(direction) : isToken(direction?.sideOf);
        if (!valid) fail(`check "${check.id}" has an unknown direction`);
      }
      if ('slot' in strategy && !known.includes(strategy.slot)) fail(`check "${check.id}" fixes an unknown slot`);
      if ('token' in strategy && !isToken(strategy.token) && !(strategy.token === 'waterLabel' && check.subject === 'waterLabel')) fail(`check "${check.id}" fixes an unknown token`);
      if ('fallback' in strategy && !isToken(strategy.fallback)) fail(`check "${check.id}" falls back to an unknown token`);
      if ('pick' in strategy && (check.subject !== 'waterLabel' || !strategy.pick.every(isToken))) fail(`check "${check.id}": pick needs the waterLabel subject and tokens`);
    }
  }
  for (const [slot, hex] of Object.entries(preset.sample ?? {})) {
    if (!known.includes(slot) || !/^#[0-9a-f]{6}$/i.test(hex)) fail(`sample colour "${slot}" is not a slot with a hex value`);
  }
  return preset;
}

export const PRESETS: PresetDefinition[] = [singleInk, figureGround, colourField].map(validatePreset);
export type PresetId = string;

export function getPreset(id: PresetId): PresetDefinition {
  const preset = PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new PresetError(`Unknown preset "${id}"`);
  return preset;
}

export const primarySlot = (preset: PresetDefinition) => preset.slots.find((slot) => slot.primary)!;
export type { TokenName };
