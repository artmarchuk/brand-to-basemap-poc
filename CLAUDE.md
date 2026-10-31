# Brand-to-Basemap

A web prototype: a designer enters 2-5 brand colours and gets a shippable, quality-checked MapLibre basemap in light, dark and data modes, then copies an embed snippet into their project, in under 5 minutes, without touching a layer list. Client-side only, open stack (MapLibre GL JS, OpenMapTiles-schema tiles from OpenFreeMap and MapTiler).

## Read first
1. `docs/p0-requirements.md`: the full P0 requirements, decisions and plan. It is the source of truth for scope.
2. `docs/briefs/m1-token-model.md`: your first task (setup, then the token model).

## Who is who
- **Artem**: product owner and the only human. Makes the key decisions. His time is the bottleneck, so he reviews at short checkpoints only.
- **PM chat** (a separate Claude conversation): owns requirements, plan and briefs. Artem relays between you and it. Put questions for the PM in your report to Artem, each with your recommendation.
- **You (Claude Code)**: the developer.
- **Design agency** (a separate Claude project): designs app UX, UI and branding in Figma after the working prototype exists (Phase 2). Not involved in P0.

## Locked decisions (Oct 31, 2026)
- Base styles: OpenFreeMap **Liberty** and MapTiler **Streets v2**. Liberty is pinned in the repo. Streets is gitignored because of its licence: `npm run fetch-styles` gets it for local tests, and the deployed app fetches it at runtime with the user's key.
- Palette derivation: **OKLCH** rules, tested on a set of 10 palettes.
- Save/share: URL-encoded state in the hash plus local autosave. The MapTiler key is never put in the URL.
- Data mode: a 0-100 "recede" slider on the light palette only (dark + data is P1). The demo overlay (fictional points and a hex-grid choropleth) is generated on the fly, is demo-only, and is never exported.
- Zoom: no multi-map strip. One main map with zoom stops (about z4, z8, z12, z16), a sweep, and a review dot per stop.
- Default location Zurich; the user can pan anywhere or pick from 6 curated cities (Kyiv included). No place search in P0.
- No forced final step: a persistent Export button.
- Buildings are always flat fills, so they show the exact `building` token. No 3D in P0.
- Token layering: brand input, base tokens, per-mode transform, per-mode overrides, auto-fix adjustments.
- Stack: Vite, TypeScript, React, maplibre-gl, culori, Vitest, plain CSS custom properties, Radix UI primitives (unstyled).
- UI tokens: Figma Variables will be the source of truth for the tool's own UI, exported as DTCG JSON into the repo and built into CSS variables. Until then, placeholder tokens.

## Working rules
- **Lean and fast.** The target is a working, presentable P0 in 1-2 days. No scope creep; anything not in the P0 requirements is out. Decide small things yourself and note them in your report.
- **Two token families, kept apart.** *Map tokens* (the 11 semantic colours, generated from brand colours) and *UI tokens* (the tool's own interface). Components never hard-code a colour, size or font; a lint check enforces it.
- **Single source of truth.** The map, modes, checks and exports all read from the map token set. No other place may hold a colour the map renders.
- **No personal or unrestricted keys in the repo or bundle.** The deployed app ships with no MapTiler key and defaults to OpenFreeMap; MapTiler works only when the user pastes their own key, which stays in localStorage and never goes in the URL. The personal `MAPTILER_KEY` lives in `.env.local` for local scripts only and is never written into fixtures, screenshots, exports or `dist/`; `npm run build` fails if it appears there. There is no demo key.
- **Attribution** (provider and OpenStreetMap) is always visible and included in exports.
- **The tool's own UI meets WCAG AA.**
- **Pure, tested core.** Style and token logic are pure functions with unit tests.
- Small commits with clear messages. Keep `docs/` current when decisions change.

## Plan and checkpoints
S0 setup, then S1 token model and palette engine (Checkpoint A: screenshots), S2 app shell F1-F4 (Checkpoint B), S3 accessibility and export F5-F6 (Checkpoint C), S4 validation and demo (final review). Details are in `docs/p0-requirements.md`.

## Reporting to Artem
Short and concrete: what works (with links to the deployed page or screenshots), what you decided on your own, questions that need a decision (each with a recommendation), and what is next. Do not paste large JSON; link to files.
