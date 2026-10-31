import Ajv from 'ajv/dist/2020';
import type { StyleSpecification } from 'maplibre-gl';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import streets from '../base-styles/streets-v2.json';
import brand from '../harness/tokens/brand.json';
import dark from '../harness/tokens/dark.json';
import neutral from '../harness/tokens/neutral.json';
import { MAPPINGS } from '../src/mapping';
import { bindProviderKey } from '../src/style/provider';
import { buildReport, reportMarkdown } from '../src/style/report';
import { cssVariableName, tokensToCss } from '../src/tokens/css';
import schema from '../src/tokens/token-set.schema.json';
import { resolveTokens, TOKEN_NAMES, type ResolvedTokens, type TokenSet } from '../src/tokens/types';

const validate = new Ajv({ strict: false }).compile(schema);

describe('token set schema', () => {
  it.each([['neutral', neutral], ['brand', brand], ['dark', dark]])('accepts %s', (_name, set) => {
    expect(validate(set), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects a missing token, a bad colour and an unknown token', () => {
    expect(validate({ ...neutral, tokens: { ...neutral.tokens, water: undefined } })).toBe(false);
    expect(validate({ ...neutral, tokens: { ...neutral.tokens, land: 'red' } })).toBe(false);
    expect(validate({ ...neutral, tokens: { ...neutral.tokens, sky: '#000000' } })).toBe(false);
  });

  it('leaves room for modes and overrides', () => {
    const set = { ...neutral, modes: { dark: { land: '#000000' } }, overrides: { light: { water: '#112233' } } };
    expect(validate(set)).toBe(true);
  });
});

describe('layering', () => {
  it('runs later layers as pure transforms, in order', () => {
    const set = neutral as TokenSet;
    const mode = (tokens: ResolvedTokens) => ({ ...tokens, land: '#111111', water: '#111111' });
    const override = (tokens: ResolvedTokens) => ({ ...tokens, water: '#222222' });
    const resolved = resolveTokens(set, [mode, override]);
    expect(resolved).toMatchObject({ land: '#111111', water: '#222222' });
    expect(set.tokens.land).toBe(neutral.tokens.land);
  });
});

describe('CSS export', () => {
  it('names every token and keeps the map family apart from --ui-*', () => {
    const css = tokensToCss(neutral.tokens);
    for (const token of TOKEN_NAMES) expect(css).toContain(`${cssVariableName(token)}: ${neutral.tokens[token]};`);
    expect(cssVariableName('roadMajor')).toBe('--b2b-road-major');
    expect(css).not.toContain('--ui-');
  });
});

describe('provider key', () => {
  const base = streets as unknown as StyleSpecification;

  it('adds the key to MapTiler URLs only at runtime', () => {
    const bound = bindProviderKey(base, MAPPINGS['streets-v2'], 'abc');
    expect(bound.glyphs).toContain('key=abc');
    expect(bound.sprite).toContain('key=abc');
    expect(JSON.stringify(base)).not.toContain('key=abc');
  });

  it('is a no-op for a provider that needs no key', () => {
    expect(bindProviderKey(base, MAPPINGS.liberty, 'abc')).toBe(base);
  });
});

describe('unmapped reports', () => {
  it.each(['liberty', 'streets-v2'])('%s report is up to date', async (id) => {
    const style = (await import(`../base-styles/${id}.json`)).default as unknown as StyleSpecification;
    const expected = reportMarkdown(buildReport(style, MAPPINGS[id]), MAPPINGS[id]);
    expect(readFileSync(`docs/reports/unmapped-${id}.md`, 'utf8')).toBe(expected);
  });
});
