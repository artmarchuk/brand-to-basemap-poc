# Token model

The map, modes, checks and exports all read one set of 11 colour tokens. This document covers schema `0.2.0`. It differs from `0.1.0` by removing `background`, so `0.1.0` token sets do not validate.

## Tokens

Map tokens are stored as hex. CSS export names are `--b2b-*`, kept apart from the tool's own `--ui-*` family.

| Token | CSS variable | Role |
| --- | --- | --- |
| `land` | `--b2b-land` | Map canvas. Neither base style has a land polygon, so the background layer is the land. Also the anchor for residential, sand, ice and institutional tints. |
| `water` | `--b2b-water` | Water fills and waterways. |
| `park` | `--b2b-park` | Parks, green landuse and landcover. |
| `roadMajor` | `--b2b-road-major` | Motorway, trunk, primary, secondary. |
| `roadMinor` | `--b2b-road-minor` | Tertiary, residential, service, paths. |
| `building` | `--b2b-building` | Building fill, drawn flat at full opacity. The outline derives from it. |
| `boundary` | `--b2b-boundary` | Admin boundary lines. |
| `labelPrimary` | `--b2b-label-primary` | Countries, cities, towns, major road names. |
| `labelSecondary` | `--b2b-label-secondary` | States, villages, suburbs, minor road names. |
| `halo` | `--b2b-halo` | Text halos. |
| `accent` | `--b2b-accent` | POI and transit stop emphasis. Colours text and icons on Streets; text only on Liberty, whose icons are baked. |

The schema is [token-set.schema.json](../src/tokens/token-set.schema.json). `modes` and `overrides` are accepted and unused in M1.

## Layering

```
brand input -> base tokens -> per-mode transform -> per-mode overrides -> auto-fix -> applyTokens
```

Each later layer is a `TokenTransform`: a pure function from tokens to tokens. `resolveTokens(tokenSet, transforms)` runs them in order, and `applyTokens` only ever sees the final result.

```ts
const darkMode: TokenTransform = (tokens) => ({ ...tokens, land: '#14171f' });
const userOverrides: TokenTransform = (tokens) => ({ ...tokens, water: '#0b2a3f' });
applyTokens(base, resolveTokens(tokenSet, [darkMode, userOverrides]), { mapping });
```

Because each layer is a separate function, a layer can be shown or reset by leaving it out of the list.

## Mapping

Each base style has one mapping file in [src/mapping](../src/mapping): an ordered rule list where the first match wins. Each rule sets a toggle group, the colour for each paint property, and optionally a label density.

- **Rules** match on layer type, `source-layer`, a `class` read from the filter, or an ID pattern. `class` matching reads expression and legacy filter syntax and ignores negations.
- **Explicit IDs** are the fallback. Liberty is mostly rules, because its IDs and filters are regular. Streets uses IDs on `transportation` layers, because their filters rely on negations such as `!in class ...`.

**Splits** run before the rules. When one base layer holds features for different tokens or groups, the mapping's `splits` divide it by class into two layers with the same paint. The rules then treat them like any other layer. Both styles use this so secondary is always `roadMajor` and stays on when `minorRoads` is off, while tertiary is `roadMinor`. The class test follows the filter syntax the layer already uses, because a filter cannot mix them.

A layer's status is computed, not declared: **mapped** if every colour is a bare token, **derived** if any colour mixes two tokens, **hidden** if the rule removes it. Derived and hidden layers must give a reason, which goes into the reports: [Liberty](reports/unmapped-liberty.md), [Streets v2](reports/unmapped-streets-v2.md).

## Fallback and drift

Streets is fetched live, so a provider can add a layer the mapping has never seen. `applyTokens` never throws on this and no original colour gets through:

- **Unknown layer:** it gets a rule from its type alone. Fills, lines and symbols become quiet neutrals that are off by default, 3D layers become flat buildings, and imagery is removed.
- **Unknown colour property, or an expression the walker cannot read:** it gets a colour chosen by property name, flat where the expression could not be read.
- **A split whose layer is gone:** it is skipped.

Each case calls `onWarning` with a `StyleWarning` (code, layer ID, message), which defaults to `console.warn`. M4 turns these into a UI notice. Tests require no warnings on the local styles, so a gap in a mapping still fails CI.

`npm run check-drift` compares the live styles with the mappings and exits 1 if a mapping needs updating. It lists fallbacks and rules naming layers that are gone, plus additions and removals against the local copy. Streets needs `MAPTILER_KEY`.

## Colour checks

The survivor test runs a sentinel token set and fails if any original colour remains in the output. Its allow-list is empty. The only colours outside token control are in sprites (see Known limits).

The isolation test changes each token in turn and requires that exactly the layers reading that token change, and that every token is read by at least one layer.

## Derived colours

A derived colour is an OKLCH mix of one token towards another, for example `tint('roadMajor', 'labelPrimary', 0.25)` for a casing. Mixing towards a token rather than applying a fixed lighter or darker offset means the result works in light and dark sets: `labelPrimary` contrasts with the map in both, so a casing stays visible either way.

## Zoom behaviour

The structure of each paint value is preserved: `interpolate`, `step`, `match`, `case`, `coalesce` and legacy `{stops}`, including nesting. Only colour outputs change. Inputs and match labels are never touched, and an unknown operator throws.

For a plain token assignment, each stop keeps its original lightness offset from the last stop and its original alpha, so the last stop lands on the token and earlier stops ramp around it. If a ramp would pass white or black, the whole ramp shifts to fit, so stops stay ordered and distinct.

When branches of an expression belong to different tokens, the rule uses `stops` to assign one colour per position. The Streets road-construction layer does this for its major and minor branches.

Widths and label sizes are not touched. **Extension point:** a per-token ramp override would be a new optional `ramps` field on the token set, keyed by token, applied by a new rule property alongside `colors`. Not built.

## Buildings

Rules with `flatten` draw layers as opaque fills, and `fill-extrusion` layers become `fill`. MapLibre's 3D lighting darkens walls away from the token, so a token set could not control how buildings look. Both styles use this. `npm run screens` ends with a render check: at z16, at least 5% of pixels must be the exact `building` token, for every style and token set.

## Road gap

The palette engine ([palette-engine.md](palette-engine.md)) uses this in light and dark. `enforceRoadGap(minGap)` is a `TokenTransform` that keeps roadMajor and roadMinor at least `minGap` apart in OKLCH lightness. `roadMajor` carries the brand and stays put; `roadMinor` moves. The default, 0.10, is `minRoadLightnessGap` in [src/palette/config.ts](../src/palette/config.ts). It is a floor: the ten palettes already derive gaps of at least 0.22.

## Toggle groups

Every layer carries one group in its `b2b:group` metadata: `core`, `pois`, `transit`, `buildings`, `landuse`, `minorRoads`, `boundaries` or `labels`. Labels also carry `b2b:density`.

`applyTokens(base, tokens, { mapping, groups, labelDensity })` sets visibility. The default is `core` plus `labels` at low density: land, water, parks, major roads and place labels. `core` can never be hidden.

The harness turns every group on so all layers can be inspected, so its screenshots show more than the F2 default.

## Providers

Core code knows no provider. The mapping declares `provider.keyHost`, and `bindProviderKey` adds the user's key to those URLs at runtime. Pinned styles and stored output are key-free. Sources are copied unchanged, which preserves attribution.

**Liberty** is pinned in [base-styles](../base-styles). **Streets v2 is not in the repo or the deploy**, because MapTiler's licence limits the style to use with MapTiler. `npm run fetch-styles` writes it locally, gitignored and key-free, for tests and reports. A mapping with `provider.styleUrl` is fetched at runtime by `loadBaseStyle` using the user's key, and the build refuses a `dist/` containing MapTiler's style. The mapping file and report stay in the repo.

The runtime fetch means Streets is not version-pinned in production. See Fallback and drift.

Liberty's harness styles are static files on plain MapLibre with no prototype code. Streets restyles in the browser through `harness/runtime.ts`, then hands the result to the same plain map.

## Adding a base style

1. Add the style to `scripts/fetch-styles.mjs` and run `npm run fetch-styles`. If its licence rules out a public copy, gitignore it and set `provider.styleUrl`.
2. Write `src/mapping/<id>.ts` and register it in `src/mapping/index.ts`. Any unmapped layer or colour property fails the `needs no fallback` test with its name, so the failures work as a to-do list.
3. Add the ID to the test cases, `scripts/build-harness.ts`, the harness page and `scripts/capture-screens.mjs`.
4. Run `npm run reports`.

No core code changes. Step 3 is test and harness wiring, not model code.

## Known limits

- **Liberty sprites are baked.** All 264 icons are non-SDF, so POI icons, highway shields, one-way arrows and town dots keep provider colours. This is most visible on dark sets. Shield text keeps MapLibre's default black because it sits on a light baked sprite.
- **Liberty's `road_minor` has zero width until z13.5.** So below that zoom, tertiary is the only `roadMinor` colour on Liberty, and it is off under the F2 default.
- **Road label class on Streets.** One `Road labels` layer holds all classes, so they all use `labelSecondary`.
- **Shaded relief.** Liberty's `natural_earth` raster is removed, because its colours cannot be tokenised.
- **Liberty filter guard.** Three shield layers throw MapLibre warnings on features without `ref_length`. The mapping prepends a `has` check; rendering is unchanged.
- **Missing POI icons.** Both base styles request icons their sprites lack, which logs `Image could not be loaded` warnings. These come from tile data, not style validation, and also appear with the unmodified styles.
