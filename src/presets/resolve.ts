import type { LabelDensity, ToggleGroup } from '../mapping/types';
import { NO_HINTS, dataVisibility, transformData, type VisibilityHints } from '../palette/modes';
import { applyOverrides } from '../palette/resolve';
import type { Treatment } from '../style/treatment';
import { colorDistance, contrastRatio, formatColor, makeColor, mixColors, parseColor } from '../tokens/color';
import { TOKEN_NAMES, type ResolvedTokens, type TokenName } from '../tokens/types';
import { PRESET_CONFIG, type PresetConfig } from './config';
import { evaluate, parseExpression, type Expr } from './expr';
import { getPreset } from './registry';
import type { CheckDefinition, DetailGroup, FixDirection, FixStrategy, PresetDefinition, TreatmentDefinition } from './types';
import type { PresetState } from './state';

/** What one slot ended up as. `used` differs from `input` only when auto-fix moved it. */
export interface SlotResult {
  id: string;
  /** The colour the user typed, or the evaluated default. */
  input: string;
  used: string;
  source: 'user' | 'default';
}

export interface CheckResult {
  id: string;
  kind: CheckDefinition['kind'];
  /** The colour measured, and each ground with its value. */
  subject: string;
  against: { token: TokenName; value: number }[];
  /** The worst value over the grounds. */
  value: number;
  min: number;
  pass: boolean;
}

/** One change auto-fix made, for the notice next to the slot or token that caused it. */
export interface FixNotice {
  check: string;
  kind: 'slot' | 'token' | 'fallback' | 'pick';
  target: string;
  from: string;
  to: string;
}

export interface PresetResolved {
  preset: PresetDefinition;
  slots: SlotResult[];
  tokens: ResolvedTokens;
  treatment: Treatment;
  visibility: VisibilityHints;
  /** Each stage on its own: straight from the expressions, after auto-fix, after overrides (light). */
  stages: { expressions: ResolvedTokens; fixed: ResolvedTokens; overridden: ResolvedTokens };
  /** Checks after auto-fix, at the light tokens. */
  checks: CheckResult[];
  /** The same checks on the tokens the map gets (after overrides and data mode), non-label minimums relaxed in data mode. */
  finalChecks: CheckResult[];
  notices: FixNotice[];
  overriddenTokens: TokenName[];
}

/** Which token colours the water labels and which token is their halo, hence what they sit on. */
export interface WaterLabel {
  text: TokenName;
  halo: TokenName;
}

interface Draft {
  slots: Record<string, string>;
  tokens: ResolvedTokens;
  waterLabel: WaterLabel;
}

/** A pick entry is `text` (the default halo) or `text/halo`. */
const parseWaterLabel = (entry: string, fallbackHalo: TokenName): WaterLabel => {
  const [text, halo] = entry.split('/');
  return { text: text as TokenName, halo: (halo ?? fallbackHalo) as TokenName };
};
const describeWaterLabel = (label: WaterLabel) => `${label.text} on ${label.halo}`;

const parsed = new Map<string, Expr>();
const expr = (source: string) => {
  if (!parsed.has(source)) parsed.set(source, parseExpression(source));
  return parsed.get(source)!;
};

/** Slot values in order: an adjustment, else what the user set, else the default over earlier slots. */
function evaluateSlots(preset: PresetDefinition, user: Record<string, string>, adjusted: Record<string, string>, config: PresetConfig) {
  const env: Record<string, string> = {};
  const inputs: Record<string, string> = {};
  for (const slot of preset.slots) {
    inputs[slot.id] = user[slot.id] ?? evaluate(expr(slot.default!), env, config);
    env[slot.id] = adjusted[slot.id] ?? inputs[slot.id];
  }
  return { env, inputs };
}

function evaluateTokens(preset: PresetDefinition, slots: Record<string, string>, config: PresetConfig): ResolvedTokens {
  return Object.fromEntries(TOKEN_NAMES.map((token) => [token, evaluate(expr(preset.tokens[token]), slots, config)])) as ResolvedTokens;
}

const LABEL_SUBJECTS = ['labelPrimary', 'labelSecondary', 'waterLabel'];
export const isLabelCheck = (check: CheckDefinition) => LABEL_SUBJECTS.includes(check.subject);

/**
 * In data mode, non-label checks relax as the map recedes, like the F5 road rule (3:1 to 1.5:1):
 * at recede 100 their minimum is `dataRelax` of the light one. Labels never relax.
 */
export function dataMinimum(check: CheckDefinition, recede: number, config: PresetConfig = PRESET_CONFIG): number {
  if (isLabelCheck(check)) return check.min;
  return check.min * (1 - (1 - config.data.relaxTo) * (Math.min(100, Math.max(0, recede)) / 100));
}

/**
 * What a check measures against. A label sits on its halo, so for every label check the halo is a ground
 * (the rule is general: a preset need not list it). Water labels sit on their own halo token, which is
 * the water itself unless the label was given a paper halo.
 */
export function groundsOf(check: CheckDefinition, waterLabel: WaterLabel): TokenName[] {
  if (check.subject === 'waterLabel') return waterLabel.halo === 'water' ? check.against : [waterLabel.halo];
  return isLabelCheck(check) && !check.against.includes('halo') ? [...check.against, 'halo'] : check.against;
}

export function measure(check: CheckDefinition, tokens: ResolvedTokens, waterLabel: WaterLabel, min = check.min): CheckResult {
  const subject = tokens[check.subject === 'waterLabel' ? waterLabel.text : check.subject];
  const metric = check.kind === 'contrast' ? contrastRatio : colorDistance;
  const against = groundsOf(check, waterLabel).map((token) => ({ token, value: Math.round(metric(subject, tokens[token]) * 1000) / 1000 }));
  const value = Math.min(...against.map((ground) => ground.value));
  return { id: check.id, kind: check.kind, subject, against, value, min: Math.round(min * 1000) / 1000, pass: value >= min };
}

const score = (check: CheckDefinition, draft: Draft) => measure(check, draft.tokens, draft.waterLabel).value;

/**
 * Steps a colour's lightness both ways at once and returns the nearest candidate that passes, or the
 * candidate with the best score if none does. Hue and chroma are kept where the gamut allows.
 */
function nearestPassing(start: string, tryColor: (hex: string) => number, min: number, step: number, direction: 'either' | 'darker' | 'lighter' = 'either') {
  const color = parseColor(start)!;
  let best = { hex: start, value: tryColor(start) };
  if (best.value >= min) return { ...best, pass: true };
  for (let delta = step; delta <= 1 + step; delta += step) {
    const candidates = direction === 'darker' ? [color.l - delta] : direction === 'lighter' ? [color.l + delta] : [color.l - delta, color.l + delta];
    for (const l of candidates) {
      if (l < 0 || l > 1) continue;
      const hex = makeColor(l, color.c, color.h);
      const value = tryColor(hex);
      if (value >= min) return { hex, value, pass: true };
      if (value > best.value) best = { hex, value };
    }
  }
  return { ...best, pass: false };
}

/** Turns `sideOf` into darker or lighter, against the check's first ground. */
function plainDirection(direction: FixDirection | undefined, check: CheckDefinition, tokens: ResolvedTokens) {
  if (!direction || typeof direction === 'string') return direction ?? 'either';
  const ground = parseColor(tokens[check.against[0]])!.l;
  return parseColor(tokens[direction.sideOf])!.l < ground ? 'darker' : 'lighter';
}

const LABEL_TOKENS: TokenName[] = ['labelPrimary', 'labelSecondary'];

interface Context {
  preset: PresetDefinition;
  user: Record<string, string>;
  adjusted: Record<string, string>;
  config: PresetConfig;
}

function rebuild(ctx: Context, waterLabel: WaterLabel): Draft {
  const { env } = evaluateSlots(ctx.preset, ctx.user, ctx.adjusted, ctx.config);
  return { slots: env, tokens: evaluateTokens(ctx.preset, env, ctx.config), waterLabel };
}

/** Applies a non-slot strategy to a draft. Returns the new draft and the notice, or undefined if it changes nothing. */
/**
 * Wraps a scorer so that a candidate which breaks another check that passes on `draft` scores -Infinity.
 * A fix may never trade one passing check for another, which also stops two fixes from pulling one slot
 * back and forth.
 */
function guarded(check: CheckDefinition, checks: CheckDefinition[], draft: Draft) {
  const passing = checks.filter((other) => other !== check && score(other, draft) >= other.min);
  return (candidate: Draft) => (passing.every((other) => score(other, candidate) >= other.min) ? score(check, candidate) : -Infinity);
}

function applyTokenStrategy(check: CheckDefinition, strategy: FixStrategy, draft: Draft, step: number, checks: CheckDefinition[]) {
  if ('token' in strategy) {
    const token = strategy.token === 'waterLabel' ? draft.waterLabel.text : strategy.token;
    if (strategy.token === 'waterLabel' && !LABEL_TOKENS.includes(token)) return undefined;
    const direction = plainDirection(strategy.direction, check, draft.tokens);
    const scoreOf = guarded(check, checks, draft);
    const found = nearestPassing(draft.tokens[token], (hex) => scoreOf({ ...draft, tokens: { ...draft.tokens, [token]: hex } }), check.min, step, direction);
    if (found.hex === draft.tokens[token]) return undefined;
    const notice: FixNotice = { check: check.id, kind: 'token', target: token, from: draft.tokens[token], to: found.hex };
    return { draft: { ...draft, tokens: { ...draft.tokens, [token]: found.hex } }, notice };
  }
  if ('fallback' in strategy && check.subject !== 'waterLabel') {
    const from = draft.tokens[check.subject];
    const to = draft.tokens[strategy.fallback];
    if (from === to || guarded(check, checks, draft)({ ...draft, tokens: { ...draft.tokens, [check.subject]: to } }) === -Infinity) return undefined;
    return { draft: { ...draft, tokens: { ...draft.tokens, [check.subject]: to } }, notice: { check: check.id, kind: 'fallback' as const, target: check.subject, from, to } };
  }
  if ('pick' in strategy) {
    const ranked = strategy.pick.map((entry) => {
      const label = parseWaterLabel(entry, draft.waterLabel.halo);
      return { label, value: score(check, { ...draft, waterLabel: label }) };
    });
    const choice = ranked.find((candidate) => candidate.value >= check.min) ?? ranked.reduce((a, b) => (b.value > a.value ? b : a));
    if (choice.label.text === draft.waterLabel.text && choice.label.halo === draft.waterLabel.halo) return undefined;
    return { draft: { ...draft, waterLabel: choice.label }, notice: { check: check.id, kind: 'pick' as const, target: 'waterLabel', from: describeWaterLabel(draft.waterLabel), to: describeWaterLabel(choice.label) } };
  }
  return undefined;
}

/**
 * Runs the preset's checks and repairs what fails, in two passes. Slot fixes go first, because they recompute
 * every token; a slot fix is skipped when a non-slot strategy listed before it would already pass.
 * Token, fallback and pick fixes then run on the recomputed tokens. Typed colours are never overwritten:
 * a moved slot shows as `used` beside its `input`.
 */
function autoFix(ctx: Context): { draft: Draft; notices: FixNotice[] } {
  const { preset, config } = ctx;
  const step = config.autoFix.step;
  let draft = rebuild(ctx, preset.treatment.waterLabel);
  const notices: FixNotice[] = [];

  // A slot fix can break a check that passed earlier (a darker Deep darkens the park under the labels),
  // so pass one repeats until no slot moves, at most `slotRounds` times.
  for (let round = 0, moved = true; moved && round < config.autoFix.slotRounds; round++) {
  moved = false;
  for (const check of preset.checks) {
    if (score(check, draft) >= check.min) continue;
    // The non-slot strategies listed before a slot one, tried in sequence: if they pass, pass two does them.
    let trial = draft;
    const before: FixStrategy[] = [];
    // A slot candidate is scored after the strategies listed before it, so the slot moves only as far
    // as those cannot reach on their own (a mid-tone field moves a little, and the labels go black).
    const withBefore = (candidate: Draft) =>
      before.reduce((current, strategy) => applyTokenStrategy(check, strategy, current, step, preset.checks)?.draft ?? current, candidate);
    for (const strategy of check.fix) {
      if (!('slot' in strategy)) {
        trial = applyTokenStrategy(check, strategy, trial, step, preset.checks)?.draft ?? trial;
        before.push(strategy);
        if (score(check, trial) >= check.min) break;
        continue;
      }
      const slot = strategy.slot;
      const from = draft.slots[slot];
      const direction = plainDirection(strategy.direction, check, draft.tokens);
      const scoreOf = guarded(check, preset.checks, draft);
      const found = nearestPassing(from, (hex) => scoreOf(withBefore(rebuild({ ...ctx, adjusted: { ...ctx.adjusted, [slot]: hex } }, draft.waterLabel))), check.min, step, direction);
      if (!found.pass) continue;
      ctx.adjusted = { ...ctx.adjusted, [slot]: found.hex };
      draft = rebuild(ctx, draft.waterLabel);
      notices.push({ check: check.id, kind: 'slot', target: slot, from, to: found.hex });
      moved = true;
      break;
    }
  }
  }

  for (const check of preset.checks) {
    if (score(check, draft) >= check.min) continue;
    for (const strategy of check.fix) {
      if ('slot' in strategy) continue;
      const result = applyTokenStrategy(check, strategy, draft, step, preset.checks);
      if (!result) continue;
      draft = result.draft;
      notices.push(result.notice);
      if (score(check, draft) >= check.min) break;
    }
  }
  return { draft, notices };
}

/**
 * Data mode lightens surfaces, which protects dark labels but costs light ones (Paper labels on Single Ink's
 * water). Where a label check fails after recede, its grounds (and the label, if it receded) are held back towards their light colour, just
 * far enough to pass. Driven by the preset's checks, so no preset needs code of its own.
 */
function holdLabelGrounds(checks: CheckDefinition[], light: ResolvedTokens, data: ResolvedTokens, waterLabel: WaterLabel): ResolvedTokens {
  let tokens = data;
  for (const check of checks.filter(isLabelCheck)) {
    if (measure(check, tokens, waterLabel).pass) continue;
    // The label itself can recede too, when it borrows a receding token (Colour Field's water labels use roadMajor).
    const subject = check.subject === 'waterLabel' ? waterLabel.text : check.subject;
    const grounds = [...new Set([subject, ...groundsOf(check, waterLabel)])].filter((token) => tokens[token] !== light[token]);
    const at = (t: number) => {
      const next = { ...tokens };
      for (const token of grounds) next[token] = formatColor({ ...mixColors(parseColor(light[token])!, parseColor(data[token])!, t), alpha: 1 });
      return next;
    };
    // Largest share of the recede that still passes, by bisection. t = 0 is the light colour, which passed.
    let [low, high] = [0, 1];
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      if (measure(check, at(mid), waterLabel).pass) low = mid;
      else high = mid;
    }
    tokens = at(low);
  }
  return tokens;
}

function resolveTreatment(definition: TreatmentDefinition, waterLabel: WaterLabel, config: PresetConfig): Treatment {
  const road = (spec: TreatmentDefinition['roadMajor']) => ({
    ...(spec.weight !== 'base' && { width: config.weights[spec.weight] }),
    casing: spec.casing === 'hairline' ? { hairline: config.casingHairlinePx } : spec.casing,
  });
  return {
    roadMajor: road(definition.roadMajor),
    roadMinor: road(definition.roadMinor),
    ...(definition.boundaryDash && { boundaryDash: definition.boundaryDash }),
    // A halo other than the water itself is the label's ground, so it is drawn wide and unblurred.
    waterLabel: { text: waterLabel.text, halo: waterLabel.halo, ...(waterLabel.halo !== 'water' && { haloWidth: config.waterLabelHaloWidth }) },
    accentOutline: definition.accentOutline,
    ...(definition.urbanLanduseFade && { urbanLanduseFade: definition.urbanLanduseFade }),
    ...(definition.hide && { hide: definition.hide }),
    ...(definition.labelHaloWidth !== undefined && { labelHaloWidth: definition.labelHaloWidth }),
  };
}

/**
 * primary + optional slots -> preset expressions -> auto-fix -> overrides -> data transform.
 * Pure and deterministic. The result feeds applyTokens with its treatment.
 */
export function resolvePreset(state: PresetState, config: PresetConfig = PRESET_CONFIG): PresetResolved {
  const preset = getPreset(state.preset);
  const ctx: Context = { preset, user: state.slots, adjusted: {}, config };
  const { env: plain, inputs } = evaluateSlots(preset, state.slots, {}, config);
  const expressions = evaluateTokens(preset, plain, config);
  const { draft, notices } = autoFix(ctx);

  const overridden = applyOverrides(draft.tokens, state.overrides.light);
  const data = state.mode === 'data';
  const tokens = data
    ? applyOverrides(holdLabelGrounds(preset.checks, overridden, transformData(overridden, state.recede), draft.waterLabel), state.overrides.data)
    : overridden;
  const modeOverrides = state.overrides[state.mode];

  return {
    preset,
    slots: preset.slots.map((slot) => ({
      id: slot.id,
      input: inputs[slot.id],
      used: draft.slots[slot.id],
      source: slot.id in state.slots ? 'user' : 'default',
    })),
    tokens,
    treatment: resolveTreatment(preset.treatment, draft.waterLabel, config),
    visibility: data ? dataVisibility(state.recede) : NO_HINTS,
    stages: { expressions, fixed: draft.tokens, overridden },
    checks: preset.checks.map((check) => measure(check, draft.tokens, draft.waterLabel)),
    finalChecks: preset.checks.map((check) => measure(check, tokens, draft.waterLabel, data ? dataMinimum(check, state.recede, config) : check.min)),
    notices,
    overriddenTokens: TOKEN_NAMES.filter((token) => token in modeOverrides),
  };
}

/** The preset's toggle defaults, the user's own choices on top, and locked groups forced on. */
export function presetDetails(
  preset: PresetDefinition,
  choices: Partial<Record<DetailGroup, boolean>>,
  densityChoice?: LabelDensity,
): { groups: ToggleGroup[]; labelDensity: LabelDensity; locked: DetailGroup[] } {
  const groups: ToggleGroup[] = ['core', 'labels'];
  for (const [group, on] of Object.entries(preset.detailDefaults)) {
    if (group === 'labelDensity') continue;
    const detail = group as DetailGroup;
    const locked = preset.lockedDetails.includes(detail);
    if (locked ? on : (choices[detail] ?? on)) groups.push(detail);
  }
  return { groups, labelDensity: densityChoice ?? preset.detailDefaults.labelDensity, locked: preset.lockedDetails };
}
