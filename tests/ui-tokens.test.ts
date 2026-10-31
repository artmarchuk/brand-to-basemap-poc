import { wcagContrast } from 'culori';
import { describe, expect, it } from 'vitest';
import tokens from '../tokens/ui.tokens.json';

// Follows {color.x.y} aliases down to a hex value.
function resolve(path: string): string {
  const node = path.split('.').reduce<any>((tree, key) => tree[key], tokens); // eslint-disable-line @typescript-eslint/no-explicit-any
  const alias = /^\{(.+)\}$/.exec(node.$value);
  return alias ? resolve(alias[1]) : node.$value;
}

describe('UI token contrast (WCAG AA)', () => {
  it.each([
    ['color.text.primary', 'color.surface.base', 4.5],
    ['color.text.primary', 'color.surface.raised', 4.5],
    ['color.text.primary', 'color.surface.sunken', 4.5],
    ['color.text.secondary', 'color.surface.base', 4.5],
    ['color.text.secondary', 'color.surface.raised', 4.5],
    ['color.text.secondary', 'color.surface.sunken', 4.5],
    ['color.text.on-accent', 'color.accent.default', 4.5],
    ['color.text.on-accent', 'color.accent.hover', 4.5],
    ['color.border.strong', 'color.surface.base', 3],
    ['color.focus.ring', 'color.surface.base', 3],
    ['color.focus.ring', 'color.surface.sunken', 3],
  ])('%s on %s reaches %d:1', (foreground, background, minimum) => {
    expect(wcagContrast(resolve(foreground), resolve(background))).toBeGreaterThanOrEqual(minimum);
  });
});
