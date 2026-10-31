# Brand-to-Basemap

Enter 2-5 brand colours and get a quality-checked MapLibre basemap in light, dark and data modes, with an embed snippet. Client-side only.

```sh
npm install
npm run dev     # local app
npm test        # unit tests and lint guards
npm run build   # tokens, lint, typecheck, bundle
```

Scope and plan: [docs/p0-requirements.md](docs/p0-requirements.md). Stack and UI token pipeline: [docs/stack.md](docs/stack.md).

The MapTiler key comes from the `MAPTILER_KEY` environment variable or `.env.local`. It is never committed.
