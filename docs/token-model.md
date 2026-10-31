# Token model

The map, modes, checks and exports all read one set of 12 colour tokens. This document covers schema `0.1.0`, built in M1.

## Tokens

Map tokens are stored as hex. CSS export names are `--b2b-*`, kept apart from the tool's own `--ui-*` family.

| Token | CSS variable | Role |
| --- | --- | --- |
| `background` | `--b2b-background` | Map canvas. Neither base style has a land polygon, so this is what reads as land. |
| `land` | `--b2b-land` | Residential land, and the anchor for sand, ice and institutional tints. |
| `water` | `--b2b-water` | Water fills and waterways. |
| `park` | `--b2b-park` | Parks, green landuse and landcover. |
| `roadMajor` | `--b2b-road-major` | Motorway, trunk, primary. Secondary and tertiary on Liberty. |
| `roadMinor` | `--b2b-road-minor` | Residential, service, paths. Also secondary and tertiary on Streets. |
| `building` | `--b2b-building` | Building fill. The outline derives from it. |
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
const darkMode: TokenTransform = (tokens) => ({ ...tokens, land: '#1c2029' });
const userOverrides: TokenTransform = (tokens) => ({ ...tokens, water: '#0b2a3f' });
applyTokens(base, resolveTokens(tokenSet, [darkMode, userOverrides]), { mapping });
```

Because each layer is a separate function, a layer can be shown or reset by leaving it out of the list.

## Mapping

Each base style has one mapping file in [src/mapping](../src/mapping): an ordered rule list where the first match wins. Each rule sets a toggle group, the colour for each paint property, and optionally a label density.

- **Rules** match on layer type, `source-layer`, a `class` read from the filter, or an ID pattern. `class` matching reads expression and legacy filter syntax and ignores negations.
- **Explicit IDs** are the fallback. Liberty is mostly rules, because its IDs and filters are regular. Streets uses IDs on `transportation` layers, because their filters rely on negations such as `!in class ...`.

A layer's status is computed, not declared: **mapped** if every colour is a bare token, **derived** if any colour mixes two tokens, **hidden** if the rule removes it. `applyTokens` throws if a layer has no rule or a colour property has no assignment, so no colour can pass through unnoticed. Derived and hidden layers must give a reason, which goes into the reports: [Liberty](reports/unmapped-liberty.md), [Streets v2](reports/unmapped-streets-v2.md).

The survivor test runs a sentinel token set and fails if any original colour remains in the output. Its allow-list is empty. The only colours outside token control are in sprites (see Known limits).

## Derived colours

A derived colour is an OKLCH mix of one token towards another, for example `tint('roadMajor', 'labelPrimary', 0.25)` for a casing. Mixing towards a token rather than applying a fixed lighter or darker offset means the result works in light and dark sets: `labelPrimary` contrasts with the map in both, so a casing stays visible either way.

## Zoom behaviour

The structure of each paint value is preserved: `interpolate`, `step`, `match`, `case`, `coalesce` and legacy `{stops}`, including nesting. Only colour outputs change. Inputs and match labels are never touched, and an unknown operator throws.

For a plain token assignment, each stop keeps its original lightness offset from the last stop and its original alpha, so the last stop lands on the token and earlier stops ramp around it. If a ramp would pass white or black, the whole ramp shifts to fit, so stops stay ordered and distinct.

When branches of an expression belong to different tokens, the rule uses `stops` to assign one colour per position. Streets' `Tunnel` layer does this for its major and minor branches.

Widths and label sizes are not touched. **Extension point:** a per-token ramp override would be a new optional `ramps` field on the token set, keyed by token, applied by a new rule property alongside `colors`. Not built.

## Toggle groups

Every layer carries one group in its `b2b:group` metadata: `core`, `pois`, `transit`, `buildings`, `landuse`, `minorRoads`, `boundaries` or `labels`. Labels also carry `b2b:density`.

`applyTokens(base, tokens, { mapping, groups, labelDensity })` sets visibility. The default is `core` plus `labels` at low density: land, water, parks, major roads and place labels. `core` can never be hidden.

The harness turns every group on so all layers can be inspected, so its screenshots show more than the F2 default.

## Providers

Core code knows no provider. The mapping declares `provider.keyHost`, and `bindProviderKey` adds the user's key to those URLs at runtime. Pinned styles and stored output are key-free. Sources are copied unchanged, which preserves attribution.

Base styles are pinned in [base-styles](../base-styles); `npm run styles:fetch` refreshes them and records the source URL and date in `metadata["b2b:pin"]`.

## Adding a base style

1. Add the style to `scripts/fetch-base-styles.mjs` and run `npm run styles:fetch`.
2. Write `src/mapping/<id>.ts` and register it in `src/mapping/index.ts`. Any unmapped layer or colour property throws with its name, so the errors work as a to-do list.
3. Add the ID to the test cases, `scripts/build-harness.ts`, the harness page and `scripts/capture-screens.mjs`.
4. Run `npm run reports`.

No core code changes. Step 3 is test and harness wiring, not model code.

## Known limits

- **Liberty sprites are baked.** All 264 icons are non-SDF, so POI icons, highway shields, one-way arrows and town dots keep provider colours. This is most visible on dark sets. Shield text keeps MapLibre's default black because it sits on a light baked sprite.
- **Road classes do not split at the token boundary.** Liberty draws secondary and tertiary in one layer, so tertiary reads as major. Streets draws them in "Minor road", so secondary reads as minor and follows the `minorRoads` toggle.
- **Road label class on Streets.** One `Road labels` layer holds all classes, so they all use `labelSecondary`.
- **Shaded relief.** Liberty's `natural_earth` raster is removed, because its colours cannot be tokenised.
- **Liberty filter guard.** Three shield layers throw MapLibre warnings on features without `ref_length`. The mapping prepends a `has` check; rendering is unchanged.
- **3D walls.** From about z14, both styles draw `fill-extrusion` buildings. `building` sets their colour, but MapLibre's lighting darkens the walls, so they look much darker than the token. Liberty's are the most visible, at 0.8 opacity. The base styles do the same.
- **Missing POI icons.** Both base styles request icons their sprites lack, which logs `Image could not be loaded` warnings. These come from tile data, not style validation, and also appear with the unmodified styles.
