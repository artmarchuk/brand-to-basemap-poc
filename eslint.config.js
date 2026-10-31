import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Hard-coded design values in UI code. The UI family lives in tokens/ui.tokens.json.
const noHardCodedDesignValues = [
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: 'Hard-coded colour: use a --ui-* token from CSS.',
  },
  {
    selector: 'Literal[value=/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/]',
    message: 'Hard-coded colour: use a --ui-* token from CSS.',
  },
  {
    selector: "JSXAttribute[name.name='style'] Literal:not([value=/^var\\(--ui-/])",
    message: 'Hard-coded style value: use a CSS class or a --ui-* token.',
  },
  {
    selector: "JSXAttribute[name.name='style'] TemplateLiteral",
    message: 'Hard-coded style value: use a CSS class or a --ui-* token.',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['*.{js,mjs,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Map-token code (src/tokens, src/mapping, src/style) legitimately holds colour data.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/tokens/**', 'src/mapping/**', 'src/style/**'],
    rules: { 'no-restricted-syntax': ['error', ...noHardCodedDesignValues] },
  },
);
