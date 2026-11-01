# Palette engine

Turns 2-5 brand colours into the 11 map tokens, then derives dark and data variants. Pure functions in [src/palette](../src/palette), all numbers in [config.ts](../src/palette/config.ts). Judge it by the [contact sheets](screens/m2/) and the [contrast report](contrast-report.md), not by the tests alone.

## Pipeline

```
brand input -> base tokens -> per-mode transform -> per-mode overrides -> auto-fix -> applyTokens
```

| Stage | Function | Notes |
| --- | --- | --- |
| Brand input | `BrandInput` | `{ colors: string[], primary: number }`, 2-5 hex colours. |
| Base tokens | `deriveTokens(brand)` | Light tokens. Includes the road gap. |
| Mode transform | `transformForMode(tokens, mode, { recede })` | Returns tokens and `VisibilityHints`. |
| Overrides | `applyOverrides(tokens, overrides)` | Per mode, per token. |
| Auto-fix | `autoFix` | Identity until S3. |
| Whole pipeline | `resolve(state)` | Returns tokens, hints, each stage, and which tokens are overridden. |

`resolve` feeds `applyTokens`, so the map only ever sees the final set. **Dark** derives from the base tokens. **Data** derives from the light tokens *including light overrides*, then applies data overrides, so a light override does not vanish in data mode.

## State

`BrandState` is plain JSON with `version: 1`: brand, active mode, recede, and overrides per mode. `parseState` validates anything untrusted, such as a decoded URL, and returns a clean state or throws a `PaletteError` with a `code`. Overrides live beside the brand, so they survive brand changes until `resetOverride` or `resetOverrides`. All functions return new objects. The URL layer is not built.

## Rules for the light tokens

All colour maths is OKLCH. Out-of-gamut colours lose chroma at constant lightness and hue, never channel clipping.

| Token | Rule |
| --- | --- |
| `land` | L 0.96, chroma at most 0.012. Seeded by the lightest brand colour with chroma between 0.008 and 0.06 (a cream, a pale blue), at that colour's own hue and chroma within the cap. Without one: 10% of the primary's chroma, at the primary's hue. |
| `water` | L 0.86. Hue from the brand colour nearest 240° if within 40°, else 240° moved up to 15° towards the brand hue. Chroma 0.03-0.06. |
| `park` | The same, around 140°, L 0.90, chroma 0.03-0.07. |
| `building` | 0.045 darker than land, tinted by the second colour (below). |
| `boundary` | L 0.56, so it reaches 3:1 on land. Tinted by the second colour. |
| `roadMajor` | Brand hue and chroma (0.08-0.20), with the primary's lightness held to 0.50-0.62. At most 0.62 so it reaches 3:1 on land. Grey brands get grey roads. |
| `roadMinor` | L 0.82 (1.5:1 on land), 45% of the second colour's chroma (the major chroma without one), at the second colour's hue, then pushed apart from `roadMajor` by the gap rule. |
| `labelPrimary`, `labelSecondary` | Brand-tinted neutrals, darkened until 7:1 and 4.5:1 against the worst of land, water, park and building. |
| `halo` | Land lightness plus 0.02, so it always sits on the map. |
| `accent` | The brand colour that keeps the most chroma after reaching 4.5:1 on land, with each unit of lightness moved costing 0.5 chroma. Greys get a blue at L 0.5. |

**Second colour.** The most chromatic brand colour that is not the tint source (the primary) shapes `roadMinor`, `boundary` and the `building` tint, so a second brand colour shows on the map. With no such colour, the primary tints them as before. Checkpoint A2 decision; the thresholds are in `secondColour` in the config.

**Why water and park are anchored.** A map with orange water reads as broken. Without the 15° cap, a red brand pulled the water hue to violet (285°).

**Why the accent is chosen by cost.** The most chromatic colour can be a yellow that must be darkened to mud. Choosing by retained chroma picks the green on Verdant and the ink on Saffron & Ink.

## Dark

Per-token targets that keep the light tokens' hue: land L 0.22, water 0.15, park 0.265, building land+0.10, roads 0.66 and 0.42, labels 0.90 and 0.72 (then raised to contrast), halo land-0.03, accent at least 0.70. Chroma floors on water, park, roads and accent keep a chromatic brand from going grey, and apply only when the brand has a hue. The road gap applies here too.

## Data

`recede` 0-100. Chroma on land, water, park, building, roads and boundary falls to 20% at 100. Lightness of those fills moves 60% of the way to the mean of the surfaces, **except that surfaces may only get lighter**. Labels, halo and accent never change, so darker surfaces would cost them contrast. An earlier version pulled surfaces towards the mean of all fills, which dropped `labelSecondary` on water below 4.5:1 for four palettes and `accent` on land below 4.5:1 for seven.

`recede` 0 returns the light tokens, the same object. The change is continuous and monotonic. Hints: POIs hidden above 30, minor labels thinned above 60. `applyVisibility` turns hints into toggle groups and density: thinning sets `labelDensity` to `low`, which keeps place names only, so it also drops road names. That is the closest the M1 groups get to "minor labels".

## Road gap

`enforceRoadGap` keeps `roadMajor` and `roadMinor` at least `minRoadLightnessGap` apart in OKLCH lightness, moving only `roadMinor`. The default is **0.10**. On the ten palettes the derived gap is 0.22-0.34 in light and 0.24 in dark, so the floor never binds on them. It still holds on 150 seeded-random brands in the tests. Overrides can break it, since the user chose those colours, and the engine leaves them alone. Tuning it up needs a visual reason, so it stays at 0.10 until one appears.

## Tunables

Everything is in [config.ts](../src/palette/config.ts), each with a comment: road gap; minimum hue chroma; neutral hue; water and park anchoring; per-token lightness and chroma targets for light and dark; label contrast targets; accent selection; data chroma share, lightness pull and hint thresholds.

## Adding a token

1. Add it to `TOKEN_NAMES` in [types.ts](../src/tokens/types.ts) and to the schema, and bump the schema version.
2. Add a rule in `deriveTokens`, and a dark target in `transformDark`.
3. Map it in each base style's mapping file.
4. Decide whether data mode recedes it, in `modes.ts`.
5. Add a contrast pair to `scripts/generate-contrast-report.ts` if F5 should check it.

## Performance

`resolve` plus `applyTokens`, in Chrome on the developer's Mac, median of 40 runs after 5 warm-ups, at data mode, recede 60, on the five-colour palette:

| Style | Median | 95th percentile |
| --- | --- | --- |
| Liberty (111 layers) | 0.7 ms | 0.9 ms |
| Streets v2 (94 layers) | 0.8 ms | 1.1 ms |

The budget is 300 ms for the whole live update. This is the style build only: MapLibre's `setStyle` and tile rendering come on top, and the harness does not measure them. The numbers are in [perf.json](screens/m2/perf.json).

## Known limits

- **Three brand colours do the work.** The primary shapes `roadMajor`, the lightest low-chroma colour tints the land, and the second most chromatic shapes `roadMinor`, `boundary` and `building`. Colours beyond that only influence the accent, and by chance the water and park hue.
- **A dark colour can seed the land.** The lightest colour with chroma under 0.06 qualifies even if it is dark, so Tricolor Transit's navy gives a pale blue land.
- **A quiet water cannot reach 3:1.** See the [contrast report](contrast-report.md).
- **Yellows and pastels are darkened to reach contrast,** which dulls them: Saffron & Ink's roads are mustard, and Pastel Studio's are dusty mauve.
- **Dark water is near black.** Blue at lightness 0.15 cannot hold much chroma inside sRGB.
- **No gamut or vision checks beyond the sRGB clamp.**
