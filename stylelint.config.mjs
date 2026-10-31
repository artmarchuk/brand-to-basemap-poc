// UI CSS may only use tokens: raw colours, sizes and fonts fail the build.
export default {
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: ['src/ui/tokens.generated.css'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
    'unit-disallowed-list': [
      ['px', 'rem', 'em', 'pt'],
      // Media queries cannot read custom properties.
      { ignoreMediaFeatureNames: { px: ['width', 'min-width', 'max-width'] } },
    ],
    'scale-unlimited/declaration-strict-value': [
      ['/^font/', 'line-height', 'box-shadow'],
      { ignoreValues: ['inherit', 'none'] },
    ],
  },
};
