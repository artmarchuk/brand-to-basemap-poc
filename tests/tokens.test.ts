import Ajv from 'ajv/dist/2020';
import type { StyleSpecification } from 'maplibre-gl';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import brand from '../harness/tokens/brand.json';
import dark from '../harness/tokens/dark.json';
import neutral from '../harness/tokens/neutral.json';
import { MAPPINGS } from '../src/mapping';
import { bindProviderKey, loadBaseStyle } from '../src/style/provider';
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
  const base = {
    version: 8,
    glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://api.maptiler.com/maps/streets-v2/sprite',
    sources: { tiles: { type: 'vector', url: 'https://api.maptiler.com/tiles/v3/tiles.json' } },
    layers: [],
  } as StyleSpecification;

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

describe('loadBaseStyle', () => {
  const stub = (body: string, ok = true) => (async () => ({ ok, status: ok ? 200 : 403, text: async () => body })) as unknown as typeof fetch;

  it('strips the key from what it returns', async () => {
    const body = JSON.stringify({ glyphs: 'https://api.maptiler.com/fonts?key=abc', sprite: 'https://x/s?a=1&key=abc' });
    const style = await loadBaseStyle(MAPPINGS['streets-v2'], 'abc', stub(body));
    expect(JSON.stringify(style)).not.toContain('abc');
  });

  it('reports a rejected key and refuses a pinned style', async () => {
    await expect(loadBaseStyle(MAPPINGS['streets-v2'], 'abc', stub('', false))).rejects.toThrow(/403/);
    await expect(loadBaseStyle(MAPPINGS.liberty, 'abc', stub(''))).rejects.toThrow(/pinned/);
  });
});

describe('unmapped reports', () => {
  const local = ['liberty', 'streets-v2'].filter((id) => existsSync(`base-styles/${id}.json`));

  it.each(local)('%s report is up to date', (id) => {
    const style = JSON.parse(readFileSync(`base-styles/${id}.json`, 'utf8')) as StyleSpecification;
    const expected = reportMarkdown(buildReport(style, MAPPINGS[id]), MAPPINGS[id]);
    expect(readFileSync(`docs/reports/unmapped-${id}.md`, 'utf8')).toBe(expected);
  });
});
