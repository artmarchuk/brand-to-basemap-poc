// The preset expression language: slot names, hex literals and five functions, all computed in OKLCH.
//   mix(a, b, n)    n% of a blended with b
//   dark(x)         x at a low lightness, hue and chroma kept
//   light(x)        a near-white at x's hue
//   complement(x)   x's hue turned 180°, moved in lightness until it contrasts with x
//   waterFor(x)     a water colour whose hue is well away from x (Figure-Ground's derived water)
import { contrastRatio, formatColor, makeColor, mixColors, parseColor } from '../tokens/color';
import { PRESET_CONFIG, type PresetConfig } from './config';

export type Expr = { kind: 'ref'; name: string } | { kind: 'hex'; value: string } | { kind: 'num'; value: number } | { kind: 'call'; fn: string; args: Expr[] };

export const FUNCTIONS: Record<string, number> = { mix: 3, dark: 1, light: 1, complement: 1, waterFor: 1 };

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

const TOKEN = /\s*(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[(),])/y;

export function parseExpression(source: string): Expr {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    if (/^\s*$/.test(source.slice(TOKEN.lastIndex))) break;
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match) throw new ExpressionError(`Unexpected "${source.slice(start).trim()}" in "${source}"`);
    tokens.push(match[1]);
  }
  let i = 0;
  const expect = (value: string) => {
    if (tokens[i] !== value) throw new ExpressionError(`Expected "${value}" in "${source}"`);
    i++;
  };
  const node = (): Expr => {
    const token = tokens[i++];
    if (token === undefined) throw new ExpressionError(`Unexpected end of "${source}"`);
    if (token.startsWith('#')) return { kind: 'hex', value: token };
    if (/^\d/.test(token)) return { kind: 'num', value: Number(token) };
    if (!/^[A-Za-z_]/.test(token)) throw new ExpressionError(`Unexpected "${token}" in "${source}"`);
    if (tokens[i] !== '(') return { kind: 'ref', name: token };
    if (!(token in FUNCTIONS)) throw new ExpressionError(`Unknown function ${token}() in "${source}"`);
    i++;
    const args: Expr[] = [];
    while (tokens[i] !== ')') {
      args.push(node());
      if (tokens[i] === ',') i++;
      else if (tokens[i] !== ')') throw new ExpressionError(`Expected "," or ")" in "${source}"`);
    }
    expect(')');
    if (args.length !== FUNCTIONS[token]) throw new ExpressionError(`${token}() takes ${FUNCTIONS[token]} arguments in "${source}"`);
    return { kind: 'call', fn: token, args };
  };
  const result = node();
  if (i !== tokens.length) throw new ExpressionError(`Unexpected "${tokens[i]}" in "${source}"`);
  return result;
}

/** Every name an expression reads. */
export function references(expr: Expr): string[] {
  if (expr.kind === 'ref') return [expr.name];
  if (expr.kind === 'call') return expr.args.flatMap(references);
  return [];
}

const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;
const hueGap = (a: number, b: number) => Math.abs(((((b - a) % 360) + 540) % 360) - 180);

/** Moves `hex` in lightness, whichever way is shorter, until it reaches `ratio` against `against`. */
function contrastAway(hex: string, against: string, ratio: number): string {
  const color = parseColor(hex)!;
  for (let delta = 0; delta <= 1; delta += 0.005) {
    for (const l of [color.l - delta, color.l + delta]) {
      if (l < 0 || l > 1) continue;
      const candidate = makeColor(l, color.c, color.h);
      if (contrastRatio(candidate, against) >= ratio) return candidate;
    }
  }
  return makeColor(parseColor(against)!.l > 0.5 ? 0 : 1, color.c, color.h);
}

export function evaluate(expr: Expr, env: Record<string, string>, config: PresetConfig = PRESET_CONFIG): string {
  const F = config.functions;
  switch (expr.kind) {
    case 'hex':
      return formatColor({ ...parseColor(expr.value)!, alpha: 1 });
    case 'num':
      throw new ExpressionError('A number is not a colour');
    case 'ref': {
      const value = env[expr.name];
      if (value === undefined) throw new ExpressionError(`Unknown name "${expr.name}"`);
      return value;
    }
    case 'call': {
      const colour = (index: number) => parseColor(evaluate(expr.args[index], env, config))!;
      switch (expr.fn) {
        case 'mix': {
          const amount = expr.args[2];
          if (amount.kind !== 'num') throw new ExpressionError('mix() takes a number as its third argument');
          return formatColor({ ...mixColors(colour(1), colour(0), amount.value / 100), alpha: 1 });
        }
        case 'dark': {
          const x = colour(0);
          return makeColor(F.dark.l, x.c, x.h);
        }
        case 'light': {
          const x = colour(0);
          return makeColor(F.light.l, Math.min(x.c, F.light.cMax), x.h);
        }
        case 'complement': {
          const x = colour(0);
          const source = evaluate(expr.args[0], env, config);
          return contrastAway(makeColor(x.l, x.c, wrapHue(x.h + 180)), source, F.complement.contrast);
        }
        case 'waterFor': {
          const x = colour(0);
          const W = F.waterFor;
          const chroma = Math.min(W.cMax, Math.max(W.cMin, x.c * W.chromaShare));
          if (x.c < 0.03 || hueGap(x.h, W.hue) >= W.minHueGap) return makeColor(W.l, chroma, W.hue);
          // The water hue is too close to x: take the nearest hue to it that is far enough away.
          const sides = [wrapHue(x.h + W.minHueGap), wrapHue(x.h - W.minHueGap)];
          const hue = sides.sort((a, b) => hueGap(a, W.hue) - hueGap(b, W.hue))[0];
          return makeColor(W.l, chroma, hue);
        }
      }
    }
  }
  throw new ExpressionError('Unreachable');
}

/** Parses and evaluates in one step. */
export const evaluateSource = (source: string, env: Record<string, string>, config?: PresetConfig) =>
  evaluate(parseExpression(source), env, config);
