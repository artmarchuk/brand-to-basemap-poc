# Preset engine

A preset is a recipe that decides which map features carry which key colour. One colour, the primary, is enough for a full map. Code is in [src/presets](../src/presets), the presets in [presets/](../presets), and the numbers in [config.ts](../src/presets/config.ts) and the preset files. Judge it by the [contact sheets](screens/m3/), not by the tests alone.

Background: [the spec](presets-design-spec.md), [the brief](briefs/m3-presets.md) (which wins where they differ), and [the spike](spikes/presets-feasibility.md).

## Pipeline

```
primary + optional slots -> slot defaults -> token expressions -> auto-fix (checks)
  -> per-token overrides -> data transform (+ label hold) -> applyTokens with treatment
```

| Stage | Where | Notes |
| --- | --- | --- |
| Slots | `evaluateSlots` | User value, else the slot's default expression over earlier slots. |
| Tokens | `evaluateTokens` | One expression per token, over the slots. All 13 tokens. |
| Auto-fix | `autoFix` | Runs the preset's checks; moves slots, then tokens. See below. |
| Overrides | `applyOverrides` | Per token, per mode, for the active preset. Cleared on preset change. |
| Data | `transformData`, `holdLabelGrounds` | The existing recede transform, then label AA is restored. |
| Compile | `applyTokens(..., { treatment })` | Colours from tokens; widths, casings, dashes and the rest from the treatment. |

`resolvePreset(state)` runs it all and returns the tokens, the resolved treatment, each slot's input and used colour, the checks before and after overrides and data mode, and the auto-fix notices. It is pure and deterministic. The old brand-colour pipeline (`src/palette`, light/dark/data) stays in the repo and is not wired while presets are on.

## The three presets

| | Single Ink | Figure-Ground | Colour Field |
| --- | --- | --- | --- |
| Primary slot | Ink | Fabric | Field |
| Primary lands on | water | built-up land and buildings | land |
| Optional slots (default) | Paper (`light(ink)`) | Paper (`light(fabric)`), Water (`waterFor(fabric)`), Green (`paper`) | Deep (`dark(field)`), Ink (`dark(field)`), Spark (`complement(field)`) |
| Roads | Ink; medium major, hairline minor, no casings | Paper; Liberty widths, hairline casing on major | Tonal tints of the field, no casings |
| Detail | all off | buildings and built-up land, locked on | all off |

## Preset format

One JSON file per preset, validated at load by `validatePreset`, which names the file and the problem.

- **`slots`**: exactly one with `primary: true`. Every other slot needs a `default` expression, which may read earlier slots only.
- **`sample`**: the spec's sample palette, by slot.
- **`tokens`**: an expression for each of the 13 tokens.
- **`treatment`**: what is not a colour. Road `weight` (`base`, or a weight named in config) and `casing` (`base`, `none`, `hairline`) for major and minor roads; `boundaryDash`; `waterLabel` text and halo tokens; `accentOutline`; `urbanLanduseFade` zooms; and `hide`, layer roles not drawn (one-way arrows, pedestrian areas); `labelHaloWidth` for place labels.
- **`detailDefaults`** and **`lockedDetails`**: the toggles the preset starts with, and which ones the user cannot switch off.
- **`checks`**: see below.

### Expressions

Slot names, hex literals and five functions, all in OKLCH:

| Function | Meaning |
| --- | --- |
| `mix(a, b, n)` | n% of a blended with b. A near-grey end takes the other end's hue. |
| `dark(x)` | x at L 0.30, hue and chroma kept within gamut. |
| `light(x)` | L 0.97, x's hue, chroma at most 0.012. |
| `complement(x)` | Hue turned 180°, moved in lightness until 3:1 against x. |
| `waterFor(x)` | **New.** A water for Figure-Ground: the hue nearest 225° that is at least 90° from x, L 0.80, chroma half of x's within 0.04-0.09. |

### Checks and auto-fix

Each check names its subject (a token, or `waterLabel`), the grounds it is measured against, a `kind` (`contrast` is the WCAG ratio, `distance` is OKLab distance) and a minimum. Its `fix` is an ordered list of strategies:

| Strategy | Effect |
| --- | --- |
| `{ "slot": s }` | Move slot s in lightness by the smallest amount that passes. Every token is recomputed. |
| `{ "token": t }` | Move token t in lightness. `waterLabel` means the label token picked for water labels. |
| `{ "fallback": t }` | Use token t's colour for the subject. |
| `{ "pick": [t, ...] }` | Water labels only: the first token that passes, else the best one. |

Slot and token strategies take an optional `direction`: `darker`, `lighter`, or `{ "sideOf": token }` (the side of the ground that token is on, so minor roads follow major roads).

Rules:

1. **Slots first, then tokens.** Slot fixes recompute everything, so they run first. A slot moves only as far as the strategies listed before it cannot reach: each candidate is scored after those strategies run. The slot pass repeats, at most 3 times, until no slot moves.
2. **A fix never breaks a passing check.** A candidate that would fail another check that passes is rejected. This also stops two fixes from pulling one slot back and forth.
3. **Typed colours are never overwritten.** A moved slot keeps its `input`; `used` is what the map gets, and the UI shows "used: #xxxxxx".
4. **Every change is recorded** as a notice: check, kind, target, from, to.

### Thresholds

| Preset | Check | Minimum | Ground |
| --- | --- | --- | --- |
| Single Ink | Water labels (Paper) | 4.5 | water |
| | Major roads | 3 | land |
| | Minor roads | 1.5 | land |
| | Labels, primary and secondary | 4.5 | land, park |
| | Accent | 3 | land |
| Figure-Ground | Fabric apart from water | 0.12 OKLab | water |
| | Major roads, minor roads (Paper) | 2, 1.5 | built-up land |
| | Major road casing | 1.8 | land |
| | Labels, primary and secondary | 4.5 | land, halo |
| | Water labels | 4.5 | water |
| | Accent | 3 | land |
| Colour Field | Field apart from deep | 0.12 OKLab | water |
| | Major roads, minor roads | 1.5, 1.2 | land |
| | Labels, primary and secondary | 4.5 | land, park |
| | Water labels | 4.5 | water |
| | Spark | 3 | land |

## Data mode

Data mode runs the existing `transformData` on the resolved tokens, so it needs no preset code. Three generic additions:

- **Labels stay AA.** The transform only lightens surfaces. That protects dark labels and costs light ones: Paper labels on Single Ink's ink water failed in 7 of 11 palettes at recede 30. Now, where a label check fails after recede, its ground (and the label token, if it receded) is held back towards its light colour, just far enough to pass.
- **Other checks relax like the F5 road rule.** In `finalChecks`, a non-label minimum falls linearly to half at recede 100 (`data.relaxTo`), as `roadMajor` falls from 3:1 to 1.5:1.

- **Gaps stay gaps.** A token equal to the land in light mode follows the land in data mode. Without this, Figure-Ground's paper roads were pulled towards the surface mean and became grey lines on paper at z16.

The two new tokens recede like the others: `urbanLanduse` as a surface (lighter only), `roadMajorCasing` as a line.

## State

`PresetState` is version 2: `preset`, `slots` (only the ones the user set; the primary is always set), `mode` (`light` or `data`), `recede`, and `overrides` per mode for the active preset. `parsePresetState` validates untrusted input. `switchPreset` keeps the primary colour, resets the other slots to the new preset's defaults and clears overrides. The app keeps the detail toggles the user changed across a switch; locked groups stay on.

## Compiler extensions

- **Tokens:** schema 0.3.0 adds `urbanLanduse` and `roadMajorCasing`. The brand-colour engine derives both the way those layers were drawn before, so its output is unchanged.
- **Additions:** a mapping can add layers. Liberty adds `b2b_urban_landuse` (landuse classes residential, commercial, industrial and retail) after `landuse_residential`, in the new `urbanLanduse` group.
- **Roles:** rules carry a `role`, written to `b2b:role` metadata, and treatments act on roles: `roadMajor`, `roadMajorCasing`, `roadMinor`, `roadMinorCasing`, `boundary`, `waterLabel`, `poi`, `urbanLanduse`, `roadArea`, `oneWay`, `placeLabel`.
- **Hairline casing:** a casing is its road's final width ramp plus `casingHairlinePx`, found by the mapping's `casingSuffix`.

## Tunables

In [config.ts](../src/presets/config.ts): the function constants, the `hairline` and `medium` width ramps, the casing hairline, the auto-fix step and slot rounds, and the data relaxation. In the preset files: every expression, threshold, treatment and default.

## Known limits

- **Liberty only.** Streets v2 has no roles or additions yet.
- **Auto-fix can move a key colour a long way.** A mid-tone or dark primary in Colour Field, or a pastel fabric, is moved to reach label contrast. The UI shows the used colour, but the map may stop feeling on brand. See the report for the worst cases.
- **Figure-Ground labels on dark fabric rely on the Paper halo.** They are checked against paper and the halo, not against the fabric, so the preset draws a 2.5 px unblurred halo.
- **In data mode, Figure-Ground's two carriers converge** for pastel and neon palettes: both lose chroma, so the separation check fails at recede 30-100 for 1-3 of 11 palettes.
- **The Park layer's 0.7 opacity** in Liberty mixes a typed Green with the paper, so a dark green reads as khaki.
- **No live thumbnails** and no swap-ground option (brief, out of scope).
