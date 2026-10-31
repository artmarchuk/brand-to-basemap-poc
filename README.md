# Brand-to-Basemap

Enter 2-5 brand colours and get a quality-checked MapLibre basemap in light, dark and data modes, with an embed snippet. Client-side only.

```sh
npm install
npm run fetch-styles   # optional: Streets v2 for local tests, needs MAPTILER_KEY
npm run dev     # local app
npm test        # unit tests and lint guards
npm run build   # tokens, lint, typecheck, bundle
```

Scope and plan: [docs/p0-requirements.md](docs/p0-requirements.md). Stack and UI token pipeline: [docs/stack.md](docs/stack.md). Map token model: [docs/token-model.md](docs/token-model.md).

The deployed app ships with no MapTiler key. MapTiler works when a user pastes their own key. For local scripts, `MAPTILER_KEY` lives in `.env.local`, which is never committed.
