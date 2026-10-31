import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

async function cssErrors(code: string) {
  const { results } = await stylelint.lint({ code, codeFilename: 'src/ui/fixture.css' });
  return results[0].warnings.length;
}

async function tsxErrors(code: string, filePath = 'src/ui/Fixture.tsx') {
  const [result] = await new ESLint().lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length;
}

describe('stylelint guards UI CSS', () => {
  it.each([
    ['hex colour', 'a { color: #123456; }'],
    ['named colour', 'a { color: red; }'],
    ['colour function', 'a { background: oklch(50% 0.1 200); }'],
    ['token fallback colour', 'a { color: var(--ui-color-text-primary, #000); }'],
    ['pixel size', 'a { padding: 12px; }'],
    ['rem size', 'a { margin: 1rem; }'],
    ['raw font family', 'a { font-family: Arial; }'],
    ['raw font weight', 'a { font-weight: 700; }'],
    ['raw shadow', 'a { box-shadow: none, 0 0 0 var(--ui-space-1); }'],
  ])('rejects %s', async (_name, code) => {
    expect(await cssErrors(code)).toBeGreaterThan(0);
  });

  it('accepts token-only CSS', async () => {
    const code = `a {
      color: var(--ui-color-text-primary);
      padding: var(--ui-space-2);
      font-size: var(--ui-font-size-sm);
      box-shadow: var(--ui-shadow-sm);
      width: 100%;
    }`;
    expect(await cssErrors(code)).toBe(0);
  });
});

describe('eslint guards UI components', () => {
  it.each([
    ['inline colour', '<div style={{ color: "#fff" }} />'],
    ['inline size', '<div style={{ padding: 12 }} />'],
    ['inline font', '<div style={{ fontFamily: "Arial" }} />'],
    ['template value', '<div style={{ width: `${1}px` }} />'],
    ['svg fill', '<path fill="#123456" />'],
    ['rgb string', 'const c = "rgb(1, 2, 3)";'],
  ])('rejects %s', async (_name, code) => {
    expect(await tsxErrors(code)).toBeGreaterThan(0);
  });

  it('accepts a token reference in a style prop', async () => {
    expect(await tsxErrors('<div style={{ color: "var(--ui-color-text-primary)" }} />')).toBe(0);
  });

  it('leaves map-token code alone', async () => {
    expect(await tsxErrors('const land = "#e8e4da";', 'src/tokens/fixture.ts')).toBe(0);
  });
});
