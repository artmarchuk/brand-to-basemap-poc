// Builds the UI token family into CSS custom properties. Map tokens never pass through here.
export default {
  source: ['tokens/ui.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'ui',
      buildPath: 'src/ui/',
      files: [
        {
          destination: 'tokens.generated.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
  },
};
