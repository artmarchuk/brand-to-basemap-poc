import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // The property tests run the resolver hundreds of times; CI runners are several times slower than a laptop.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
