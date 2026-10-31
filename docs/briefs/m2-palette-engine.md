# Brief for Claude Code: M2 Palette Engine

**Project:** Brand-to-Basemap, P0 prototype
**Milestone:** M2, brand colours to map tokens, dark and data transforms, overrides
**From:** PM chat (owner: Artem)
**Status:** ready to start once the M1 follow-ups from Artem's checkpoint reply are done (11 tokens with `land` merged, Streets low-zoom landcover as `park`→`land`, flat buildings, Streets road classes, all-token isolation test). Items marked **[DECIDED]** are confirmed. Items marked **[PM DEFAULT]** are proposals: build on them, keep them easy to change, and flag them in your report.

---

## 1. Goal

Turn 2-5 brand colours into a complete, coherent, **good-looking** set of map tokens, and derive light, dark and data variants from it. This is the step that decides whether the product feels like a designer's tool or a colour randomiser, so quality is judged by looking at maps, not by passing tests alone.

You are building pure functions in the existing token model. You are **not** building app UI, colour pickers, contrast-check UI, auto-fix, colour-vision simulation, URL state, the demo overlay, or zoom stops. Those come later (S2, S3).

## 2. The pipeline [DECIDED, layering model]

```
brand input -> base tokens -> per-mode transform -> per-mode overrides -> auto-fix adjustments
```

Each stage is a pure function from a token set (or state) to a token set, separately visible and resettable. Suggested API (adjust names freely):

```ts
deriveTokens(brand: BrandInput): TokenSet                       // base tokens, light
transformForMode(tokens: TokenSet, mode: Mode, opts): { tokens: TokenSet; visibility: VisibilityHints }
applyOverrides(tokens: TokenSet, overrides: Partial<TokenSet>): TokenSet
resolve(state: BrandState): { tokens: TokenSet; visibility: VisibilityHints }   // the whole pipeline
```

- `BrandInput`: 2-5 hex colours and the index of the primary one.
- `BrandState`: brand input, active mode, recede value (0-100), overrides per mode (`light`, `dark`, `data`). It must be **JSON-safe and versioned**, because it will be serialised into the URL later. Do not build the URL part.
- The auto-fix stage is an identity function slot for now. Do not build auto-fix.
- `applyTokens` (from M1) only ever receives the final resolved set.
- Handle bad input with a typed error (invalid hex, fewer than 2 or more than 5 colours), never a crash.

## 3. Derivation rules (base tokens, light)

Use **OKLCH** for all colour maths [DECIDED]. Use `culori`. Gamut-map to sRGB by reducing chroma at constant hue and lightness, never by clipping channels. Keep all colour maths behind the small interface from M1.

The 11 tokens: `land`, `water`, `park`, `roadMajor`, `roadMinor`, `building`, `boundary`, `labelPrimary`, `labelSecondary`, `halo`, `accent`.

### Design principles [PM DEFAULT, challenge with evidence]

1. **Recognisability beats brand purity for water and park.** A map with orange water reads as broken. Water takes its hue from the brand colour closest to blue (OKLCH hue roughly 220-260) if one is within about 40 degrees; otherwise it uses a cool hue pulled toward the brand hue by no more than about 30%. Park does the same around green (roughly 120-160). **Brand identity is carried by roads, accent, labels and the tint of the neutrals.**
2. **Chroma caps on large-area tokens.** `land`, `water` and `park` cover most of the screen, so they stay quiet. The M1 screenshots showed what happens without caps (Europe flooded with lime green). Starting caps, to be tuned on the test set: `land` C up to about 0.015, `water` up to about 0.06, `park` up to about 0.07.
3. **Neutrals are tinted, not grey.** `land`, `building`, `boundary` and the labels take a very low chroma at the primary brand hue, so the map feels related to the brand.
4. **Road hierarchy is deliberate.** `roadMajor` carries more chroma and a clear lightness gap from `land`; `roadMinor` is quieter. Both must be clearly distinguishable from `land` and from each other. **[DECIDED]** `roadMajor` and `roadMinor` differ by at least a configurable OKLCH lightness gap, starting at 0.10 and tuned on the ten palettes. `enforceRoadGap` and `minRoadLightnessGap` already exist in `src/palette/`.
5. **Labels are safe by construction.** `labelPrimary` targets at least 7:1 against `land`, `labelSecondary` at least 4.5:1. `halo` sits close to `land` lightness. `accent` is the most chromatic brand colour (or the primary), lightness-adjusted so that it reaches at least 4.5:1 against `land`, because it colours POI text on Liberty.
6. **Deterministic.** Same input, same output. No randomness.

Rough starting points for light, as OKLCH lightness: land 0.95-0.97, water 0.84-0.88, park 0.88-0.92, building a little darker than land, roadMajor 0.55-0.70, roadMinor a clear step from land, labelPrimary below 0.30, labelSecondary 0.42-0.50. Treat these as hypotheses; the screenshots decide.

Put **every tunable number in one config file** with a comment on its purpose, so tuning needs no code changes.

## 4. Dark transform [DECIDED: derived from the same tokens, not a separate style]

Not a lightness inversion. Per-token targets that keep the brand hue, lower the chroma of large areas and avoid mud. Starting points: land 0.18-0.22, water 0.14-0.17 and clearly separable from land (the M1 dark Liberty z16 showed land, water and building too close), park slightly above land, roads lighter than land with the same major/minor gap, labels light (primary about 0.88, secondary about 0.72), halo near the dark land, accent at least 0.70. Add a chroma floor so dark maps do not turn grey-muddy for chromatic brands. Verify against the 10-palette set.

## 5. Data transform [DECIDED: one recede slider, light palette only]

`transformForMode(tokens, 'data', { recede })` with `recede` from 0 to 100:

- Scales the chroma of fills and lines (not labels) down to about 20% at 100.
- Pulls lightness of `land`, `water`, `park`, `building`, `roadMajor`, `roadMinor` toward each other, so nothing shouts.
- Labels are never faded. They keep their lightness and chroma, so they keep passing the contrast check.
- **Continuous and monotonic.** `recede = 0` must return exactly the light tokens.
- Returns `visibility` hints: POIs hidden above 30, minor labels thinned above 60. M1's group mechanism applies them; the slider UI comes in S2.
- **[PM DEFAULT]** Data mode starts from the *resolved light tokens including light overrides*, then applies data-specific overrides. Otherwise a user's light override would silently disappear in data mode.
- Data mode intentionally lowers feature contrast. Do **not** enforce a 3:1 feature threshold in data mode. Report the contrast at `recede = 100`: the threshold for data mode is an open PM decision, and your numbers inform it.

## 6. Overrides [DECIDED]

- Any single token can be overridden per mode (`light`, `dark`, `data`).
- An override survives later changes to the brand colours until reset.
- Reset per token and for all.
- The structure must keep each stage visible: the UI will later show which tokens are derived and which are overridden.

## 7. Test palette set

Ten fixtures in `fixtures/palettes.json` with **fictional brand names** (the demo will be public). Required coverage; hexes are suggestions:

| # | Name | Colours | What it tests |
| --- | --- | --- | --- |
| 1 | Fjord Bank | #0B3C5D, #D9E8F5 | Brand blue colliding with water |
| 2 | Verdant | #1F7A4D, #F2C94C | Brand green colliding with park |
| 3 | Ember | #E8442E, #2B2B2B | Saturated red-orange with charcoal |
| 4 | Saffron & Ink | #F5B700, #1B1B3A | Yellow, which fails contrast easily |
| 5 | Violet Hour | #6C3FC5, #FF6FB5, #1A1033 | Purple and pink, no natural water or park hue |
| 6 | Plainsman | #222222, #888888, #F0F0F0 | Pure greys, no hue to take |
| 7 | Neon Arcade | #00F0FF, #FF2BD6 | Extreme chroma, gamut mapping |
| 8 | Pastel Studio | #F7C6D9, #C6E2F7, #D9F2C6 | Low-contrast pastels |
| 9 | Terracotta Co. | #C65D3B, #E9D8C4, #5B6B4F, #2E3A59 | Earthy four-colour palette |
| 10 | Tricolor Transit | #D62828, #F77F00, #FCBF49, #2A9D8F, #264653 | Five colours, the maximum |

## 8. Harness and deliverables

Extend the M1 harness (still plain MapLibre, no app UI): a palette select, a mode select, a recede range input, and a way to pin one token override from the URL. Then deliver:

1. **Code and tests** for the pipeline. Unit and property tests: determinism; valid in-gamut hex for any seeded-random brand input; `recede = 0` equals light; monotonic recede; label contrast at least 7:1 and 4.5:1 on all ten palettes in light and dark; overrides survive brand changes; reset works.
2. **Contact sheets** under `docs/screens/m2/`, per palette: light, dark and data at recede 60, for Liberty and Streets, at z12 (with z4 and z16 for the three weakest palettes in your judgement). Artem reviews these, so make each sheet scannable at a glance, one image per palette or one overview plus one per palette.
3. **Contrast report** `docs/contrast-report.md`: a table per palette and mode of the pairs you think F5 should check (label on land, water, park, building and roads; roadMajor, roadMinor, water and boundary against land), with the ratios. This feeds the F5 pair-matrix decision.
4. **`docs/palette-engine.md`**: the rules and their rationale, the config file's tunables, how to add a token, known limits.
5. **Performance numbers:** time for `resolve` plus `applyTokens` on each style in the browser. The budget is a live update inside 300 ms in total, so this should be well under 100 ms.
6. **Report** to Artem.

## 9. Acceptance criteria

- [ ] All ten palettes produce valid, in-gamut token sets in light, dark and data, with no crashes and no NaN.
- [ ] Label contrast targets hold on all ten palettes without overrides, in light and dark.
- [ ] No palette floods the map with a saturated large-area colour: water, park and land stay within their chroma caps.
- [ ] Road hierarchy is visible at z12 on both styles for every palette, and the lightness gap between `roadMajor` and `roadMinor` holds on all ten palettes in light and dark, with the tuned value recorded in the config.
- [ ] Dark: land, water and building are separable on all ten palettes; no palette looks muddy to you. Name the weakest two in the report.
- [ ] Data: `recede = 0` equals light; monotonic; labels unaffected; visibility hints returned.
- [ ] Overrides work per mode, survive brand changes, and reset.
- [ ] `BrandState` is JSON-safe and versioned.
- [ ] All magic numbers are in one config file.

## 10. What to report back

1. **Result:** links to the contact sheets and the harness.
2. **Weakest palettes:** the two or three that look worst, with why and what you tried.
3. **Rules that surprised you** or that you changed from the principles above, with evidence.
4. **Contrast findings:** which pairs fail by construction and are structurally hard (for example yellow brands, pastels), because auto-fix in S3 has to handle them.
5. **Performance numbers.**
6. **Open questions** for Artem or the PM, each with your recommendation.

## 11. Working agreements

- **Judge by looking.** Review your own contact sheets critically before showing them. If a palette looks bad, fix the rules, not the test.
- **Ask early** if a principle here conflicts with what you see.
- **No scope creep.** No UI, picker, auto-fix, overlay or zoom stops.
- **Pace.** Target a working, reviewable result within the same working session. Artem's next touchpoint is the review of your contact sheets (about 15 minutes).
- Small commits, no secrets, keep `docs/` current.
- Update the 11-token list in `CLAUDE.md` and `docs/p0-requirements.md` if M1 did not already.
