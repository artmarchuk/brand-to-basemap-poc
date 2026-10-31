# Stack confirmation

Confirmed as specified: Vite, TypeScript, React, maplibre-gl, culori, Vitest, plain CSS custom properties, Radix UI primitives. No blockers.

- **Versions.** Vite 8, React 19, MapLibre GL JS 6, TypeScript 6 (typescript-eslint does not accept TS 7 yet). Exact versions are in `package-lock.json`.
- **MapLibre 6 worker.** The worker is a separate file. Every entry point must call `setWorkerUrl` with a Vite `?url` import, or the map loads without tiles (see `src/ui/MapPreview.tsx`).
- **Hosting.** GitHub Pages through `.github/workflows/deploy.yml`, on push to `main`. Tests and lint must pass before a deploy.
- **UI tokens.** Style Dictionary builds `tokens/ui.tokens.json` (DTCG) into `src/ui/tokens.generated.css`, with the `--ui-` prefix. The output is generated and not committed.
- **Lint.** `npm run build` fails on hard-coded values. Stylelint covers colours, `px`/`rem`/`em` and raw fonts or shadows in CSS. ESLint covers colours and inline style values in `src/`, except `src/tokens`, `src/mapping` and `src/style`, which hold map-token data. `tests/ui-token-lint.test.ts` proves the rules fire.

- **MapTiler keys.** The deployed app has no key. `scripts/check-no-keys.mjs` runs last in `npm run build` and fails if the local key, or anything shaped like a key in a URL, is in `dist/`. CI has no local key, so it relies on the URL pattern; a local build checks both.
- **Extra dev tools from M1.** `tsx` runs TypeScript scripts, `ajv` validates token sets against the schema in tests, and `@maplibre/maplibre-gl-style-spec` validates output styles in tests.

## Figma sync

Replace `tokens/ui.tokens.json` with the Figma Variables export. Keep the token paths, or update `src/ui/global.css` to match. Run `npm test`, which also checks AA contrast for the role pairs in `tests/ui-tokens.test.ts`.
