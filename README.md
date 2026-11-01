# Brand-to-Basemap

Enter 2-5 brand colours and get a quality-checked MapLibre basemap in light, dark and data modes, with an embed snippet. Client-side only.

```sh
npm install
npm run fetch-styles   # optional: Streets v2 for local tests, needs MAPTILER_KEY
npm run dev     # local app
npm test        # unit tests and lint guards
npm run build   # tokens, lint, typecheck, bundle
npm run contrast-report   # regenerates docs/contrast-report.md
npm run screens:m2        # contact sheets; needs `vite preview` on port 4173
```

Scope and plan: [docs/p0-requirements.md](docs/p0-requirements.md). Stack and UI token pipeline: [docs/stack.md](docs/stack.md). Map token model: [docs/token-model.md](docs/token-model.md). Palette engine: [docs/palette-engine.md](docs/palette-engine.md).

The deployed app ships with no MapTiler key. MapTiler works when a user pastes their own key. For local scripts, `MAPTILER_KEY` lives in `.env.local`, which is never committed.

## App shell (S2)

`npm run dev` starts the app: brand colours (picker or hex, one primary, sample palettes), light, dark and data modes with the recede slider and a generated demo overlay, detail toggles and label density, per-token overrides with reset, six cities, and zoom stops with a sweep and review dots. It runs on Liberty with no key. Screenshots of the real app are in `docs/screens/s2/`, made by `npm run screens:app` against `vite preview`.

Not in yet: provider switch and MapTiler key (S3), accessibility checks and per-stop status (S3), exports and URL state (S3).
