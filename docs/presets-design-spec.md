# Brand-to-Basemap: Presets Design Spec (v0.1)

Status: draft for PM review, then handoff to Claude Code
Date: 2026-11-09
Author: Artem (product), drafted with Claude
Scope: P0 test presets, Light mode only

---

## 1. Problem

In the current build, brand colours barely change the map. In the two reference screenshots (a terracotta/cream/green/navy palette and a cyan/magenta palette), the primary colour only recolours roads. Land, water and parks are derived as pale tints. Two very different brands therefore produce near-identical maps.

The cause is structural: one fixed mapping from brand colours to map features, with the primary colour assigned to the least expressive feature (roads).

## 2. Proposal

Introduce **presets**. A preset is a recipe that defines:

1. how many key colours the user supplies, and what role each one plays;
2. how each map colour token is computed from those key colours;
3. default detail settings that make the recipe work.

The user experience is organised around choosing a preset, then tweaking its key colours. Logo-to-palette remapping is a later step (P1) that fills the same slots.

**Design rule for all presets:** the primary key colour must land on at least one *area* token (land, water or built-up fabric), never on roads alone. This is the acceptance criterion that directly addresses the problem above.

## 3. Decisions already made

| # | Decision | Notes |
|---|---|---|
| D1 | Dark mode is out of scope for presets | It adds complexity and confusion to this experience. Recommend hiding the Dark option while presets are on (see 7.6). |
| D2 | Data mode is unchanged | Already implemented. It operates on the resolved map colours a preset produces. No preset-specific work. |
| D3 | Granular overrides stay | The existing "Map colours" list remains as an advanced layer on top of the preset. |

## 4. Open question for the P0 PM

**Q1. Tile and data limits for v1.** Do presets have to work with what OpenFreeMap serves (the OpenMapTiles schema, with no terrain, contours or hillshade), or may v1 also assume MapTiler-only data? This spec assumes OpenFreeMap-only. It decides whether terrain-led presets (see section 9) can be added later.

## 5. The three test presets

They were chosen because each puts the key colour on a different kind of feature and together they span 1 to 4 key colours. References are frames from the Figma frame "Branded maps", numbered 1–12 from left to right.

| | Single Ink | Figure-Ground | Colour Field |
|---|---|---|---|
| Idea | One ink on paper. The ink draws water, roads and labels. | The built-up city is the hero. Water is a second colour. The rest is paper. | The land itself is the saturated key colour, with a deeper water colour and one spark colour. |
| Key colour carrier | Water and linework | Buildings and urban landuse | Land |
| References | Frame 2 (purple Auckland; the teal New Zealand spread above it is the swapped variant) | Frames 5, 7, 9, 10; frame 4 is similar | Frames 1, 3 |
| Key colours | 1 required, 1 optional (1–2) | 3 required, 1 optional (3–4) | 3 required, 1 recommended (3–4) |
| Best for | Posters, editorial, campaign maps | Real estate, architecture, urbanism, newsrooms | Events, campaigns, store locators, loud brand pairs |

### 5.1 Key colour slots

**Single Ink**

| Slot | Required | Default if empty | Role |
|---|---|---|---|
| Ink | yes | none | Water, roads, labels |
| Paper | no | Near-white tinted with the Ink hue (OKLCH L about 97, C about 0.01) | Land, halo |

**Figure-Ground**

| Slot | Required | Default if empty | Role |
|---|---|---|---|
| Fabric | yes | none | Buildings and urban landuse (primary colour) |
| Water | yes | none | Water, accent |
| Paper | yes | none | Land, roads, halo |
| Green | no | Paper (parks read as negative space, as in the references) | Parks |

**Colour Field**

| Slot | Required | Default if empty | Role |
|---|---|---|---|
| Field | yes (primary colour) | none | Land |
| Deep | yes | dark(Field) | Water, buildings, parks tint |
| Ink | yes | dark(Field), at least 4.5:1 against Field | Labels, boundaries |
| Spark | recommended | Complement of Field, adjusted to at least 3:1 against Field | Accent: pins, selection, highlights |

### 5.2 Token mapping

Functions:
- `mix(A, B, n)` is n% of A blended with B (blend in OKLCH).
- `dark(X)` is X with lightness lowered to about L 0.30, hue and chroma kept.
- `light(X)` is X with lightness raised to about L 0.97, hue kept.

The percentages are starting values to tune visually. They are not final.

| Token | Single Ink | Figure-Ground | Colour Field |
|---|---|---|---|
| Land | Paper | Paper | **Field** |
| Water | **Ink**, solid | **Water**, solid | **Deep**, solid |
| Parks | mix(Ink, Paper, 12) | Green if set, otherwise Paper | mix(Deep, Field, 10) |
| Buildings (z13+) | mix(Ink, Paper, 20) | **Fabric**, solid | mix(Deep, Field, 20) |
| Urban landuse (below z13) | not drawn | **Fabric** | not drawn |
| Major roads | Ink, medium weight | Paper fill, hairline casing mix(Fabric, Paper, 35) | mix(light(Field), Field, 55) |
| Minor roads | Ink, hairline | Paper fill, no casing | mix(light(Field), Field, 35) |
| Boundaries | mix(Ink, Paper, 50), dashed | mix(Water, Paper, 60), dashed | mix(Ink, Field, 35), dashed |
| Labels, primary | dark(Ink) on land, Paper on water | dark(Fabric) | **Ink** |
| Labels, secondary | mix(Ink, Paper, 75) | mix(dark(Water), Paper, 75) | mix(Ink, Field, 75) |
| Label halo | Paper | Paper | Field |
| Accent (pins, selection) | Ink with a Paper outline | Water with a Paper outline | **Spark** |

Notes:
- **Single Ink, water labels.** Water labels are drawn in Paper because water is a solid Ink fill.
- **Single Ink, optional swap.** A "swap ground" toggle (ink on land, paper on water, as in the teal New Zealand spread) is a possible later option. It is not part of the P0 test.
- **Figure-Ground, roads.** Roads are paper-coloured, so inside built-up areas they read as gaps in the fabric. The hairline casing keeps major roads visible on unbuilt land.
- **Figure-Ground, buildings and landuse.** In OpenMapTiles tiles, buildings appear from about z13 (verify against the actual tiles). Below z13 the urban landuse classes (residential, commercial, industrial; verify class names) carry the Fabric colour so the preset does not look empty at z8–z12.
- **Colour Field, tonal fills.** Parks and buildings are intentionally close to the land colour. This preset is tonal by design.

### 5.3 Detail defaults per preset

These replace the global defaults when a preset is selected. The user can still change them unless marked locked.

| Setting | Single Ink | Figure-Ground | Colour Field |
|---|---|---|---|
| Buildings | off | **on, locked** | off |
| Urban landuse | n/a | **on, locked** (part of the preset core, not under the "Land use" toggle) | n/a |
| Land use (other) | off | off | off |
| Points of interest | off | off | off |
| Transit | off | off | off |
| Boundaries | off | off | off |
| Minor roads below z14 | off | off | off |
| Label density | Low | Low | Low |

### 5.4 Quality rules per preset

These extend the existing contrast checks. When a rule fails, the preset adjusts the derived value automatically and shows a notice. It never silently changes a key colour the user typed.

| Rule | Applies to | Auto-fix |
|---|---|---|
| Labels at least 4.5:1 against what they sit on | All presets | Darken or lighten the label colour. In Single Ink, if Ink is too light to be both a water fill and a label colour (for example neon cyan), darken the Ink used for water and labels. |
| Roads and pins at least 3:1 against their ground | All presets | Adjust lightness of the road colour or pin outline. |
| Minimum difference between the two carrier colours | Figure-Ground (Fabric vs Water), Colour Field (Field vs Deep) | Adjust the lightness of the secondary colour. |
| Spark at least 3:1 against Field | Colour Field | Fall back to Ink. |

Background polygons (land, parks, buildings in tonal presets) are exempt from the 3:1 rule. They carry no information on their own.

### 5.5 Sample palettes for testing

Colours below were estimated by eye from the reference frames. They were not sampled. Use them only as test inputs.

| Preset | Palette |
|---|---|
| Single Ink | Ink `#6B2C91` |
| Figure-Ground | Fabric `#E0623F`, Water `#7FBDB0`, Paper `#FBEFE0` |
| Colour Field | Field `#F59AAE`, Deep `#EA4A3C`, Ink `#3F1A8C`, Spark `#FFE600` |

Also test every preset with the two palettes from the problem screenshots (terracotta/cream/green/navy and cyan/magenta).

## 6. Preset definition format (for implementation)

Suggested JSON shape. One file per preset, loaded by id. Expressions use the functions from 5.2. Exact syntax is up to Claude Code as long as the semantics hold.

```json
{
  "id": "single-ink",
  "name": "Single Ink",
  "slots": [
    { "id": "ink",   "label": "Ink",   "required": true },
    { "id": "paper", "label": "Paper", "required": false, "default": "light(ink)" }
  ],
  "tokens": {
    "land":            "paper",
    "water":           "ink",
    "parks":           "mix(ink, paper, 12)",
    "buildings":       "mix(ink, paper, 20)",
    "roadsMajor":      "ink",
    "roadsMinor":      "ink",
    "boundaries":      "mix(ink, paper, 50)",
    "labelsPrimary":   "dark(ink)",
    "labelsSecondary": "mix(ink, paper, 75)",
    "labelHalo":       "paper",
    "accent":          "ink"
  },
  "overrides": {
    "waterLabels": "paper",
    "accentOutline": "paper"
  },
  "detailDefaults": { "buildings": false, "landuse": false, "poi": false, "transit": false, "boundaries": false, "minorRoadsBelowZ14": false, "labelDensity": "low" },
  "lockedDetails": [],
  "checks": ["labelContrast", "roadContrast"]
}
```

```json
{
  "id": "figure-ground",
  "name": "Figure-Ground",
  "slots": [
    { "id": "fabric", "label": "Fabric", "required": true },
    { "id": "water",  "label": "Water",  "required": true },
    { "id": "paper",  "label": "Paper",  "required": true },
    { "id": "green",  "label": "Green",  "required": false, "default": "paper" }
  ],
  "tokens": {
    "land":            "paper",
    "water":           "water",
    "parks":           "green",
    "buildings":       "fabric",
    "urbanLanduse":    "fabric",
    "roadsMajor":      "paper",
    "roadsMajorCasing":"mix(fabric, paper, 35)",
    "roadsMinor":      "paper",
    "boundaries":      "mix(water, paper, 60)",
    "labelsPrimary":   "dark(fabric)",
    "labelsSecondary": "mix(dark(water), paper, 75)",
    "labelHalo":       "paper",
    "accent":          "water"
  },
  "overrides": { "accentOutline": "paper" },
  "detailDefaults": { "buildings": true, "landuse": false, "poi": false, "transit": false, "boundaries": false, "minorRoadsBelowZ14": false, "labelDensity": "low" },
  "lockedDetails": ["buildings", "urbanLanduse"],
  "checks": ["labelContrast", "roadContrast", "carrierSeparation:fabric,water"]
}
```

```json
{
  "id": "colour-field",
  "name": "Colour Field",
  "slots": [
    { "id": "field", "label": "Field", "required": true },
    { "id": "deep",  "label": "Deep",  "required": true,  "default": "dark(field)" },
    { "id": "ink",   "label": "Ink",   "required": true,  "default": "dark(field)" },
    { "id": "spark", "label": "Spark", "required": false, "default": "complement(field)" }
  ],
  "tokens": {
    "land":            "field",
    "water":           "deep",
    "parks":           "mix(deep, field, 10)",
    "buildings":       "mix(deep, field, 20)",
    "roadsMajor":      "mix(light(field), field, 55)",
    "roadsMinor":      "mix(light(field), field, 35)",
    "boundaries":      "mix(ink, field, 35)",
    "labelsPrimary":   "ink",
    "labelsSecondary": "mix(ink, field, 75)",
    "labelHalo":       "field",
    "accent":          "spark"
  },
  "overrides": { "waterLabelHalo": "deep" },
  "detailDefaults": { "buildings": false, "landuse": false, "poi": false, "transit": false, "boundaries": false, "minorRoadsBelowZ14": false, "labelDensity": "low" },
  "lockedDetails": [],
  "checks": ["labelContrast", "roadContrast", "carrierSeparation:field,deep", "accentContrast"]
}
```

Implementation notes:
- Compute all blends in OKLCH, not RGB, so tints keep their hue.
- `complement(X)` is the hue rotated by 180 degrees, with lightness and chroma adjusted to pass the accent check.
- The preset resolves to the same token set the app already uses (Land, Water, Parks, Major roads, Minor roads, Buildings, Boundaries, Labels primary, Labels secondary, Label halo, Accent), so the existing style compiler and Data mode need no change.
- Tokens beyond the current list (`urbanLanduse`, `roadsMajorCasing`) need a mapping to layers. Check the layer IDs in the style JSON when implementing.

## 7. Product tweak recommendations

### 7.1 Make the preset the first decision
Replace the top of the left panel ("Brand colours" list) with a preset picker. Each option shows a live thumbnail rendered from the current map view, using the user's current colours where possible and the preset's sample palette otherwise. The map itself should update as soon as a preset is chosen.

### 7.2 Replace the generic colour list with named slots
Show only the slots of the selected preset, each labelled by role (for example Fabric, Water, Paper). Remove "Add colour", "Remove" and the "Use 2 to 5 colours" copy, because the slot count is now fixed by the preset. Keep the colour picker and hex input. Mark optional slots as optional and show their default when empty.

### 7.3 Per-preset sample palettes
Replace the global "Try a sample palette" dropdown with palettes designed for the selected preset (section 5.5). A random palette in the wrong role produces a bad map. Palettes tied to the preset prevent that.

### 7.4 Switching presets
Recommend carrying colours over by slot order (first slot to first slot, and so on), so the user's primary colour is kept. Slots that have no counterpart take the new preset's defaults. Show a one-step undo.

### 7.5 Overrides (D3)
- Keep the "Map colours" list, with the existing Derived / overridden states.
- Overrides should be cleared when the preset changes, because they were tuned against the old recipe. Show a short notice, with undo.
- "Reset all" restores the preset's derived values.

### 7.6 Mode control
With Dark out of scope (D1), recommend hiding Dark while presets are on, so the control becomes Light and Data. Presets are designed for Light. Data mode needs no change (D2).

### 7.7 Detail toggles
Apply the per-preset defaults in 5.3. In Figure-Ground, show Buildings as on and not changeable, with a short hint ("Part of this preset"), instead of hiding it.

### 7.8 Zoom strip and quality checks
Keep both and run them per preset. Check each preset at z4, z8, z12 and z16. Figure-Ground is the most likely to break at z8–z12 (see the buildings note in 5.2). Surface auto-fix notices from 5.4 inline next to the slot that caused them.

### 7.9 Logo remap (P1, not in this scope)
Same slots, filled automatically. Proposed role assignment:
- Single Ink: the most saturated mid-dark colour is Ink.
- Figure-Ground: the lightest colour is Paper, the most chromatic is Fabric, and the colour furthest from Fabric in hue is Water.
- Colour Field: the dominant saturated colour is Field, the darkest is Ink, and the remaining most distinct colour is Spark.

## 8. Acceptance criteria

1. Each preset renders for at least three locations (Zurich plus two others) at z4, z8, z12 and z16 with no broken or empty-looking zoom.
2. With the same four test palettes (section 5.5 plus the two problem-screenshot palettes), the three presets produce visibly different maps, and the key colour appears on at least one area token in every preset.
3. All label and road contrast checks pass at the defaults, or auto-fix and tell the user.
4. Switching presets keeps the primary colour and does not reset the view or the detail toggles the user changed (except locked ones).
5. Data mode works on all three presets without preset-specific code.
6. Overrides can be applied on top of every preset and are cleared on preset change.

## 9. Out of scope and later

- Dark mode (D1).
- Terrain-led presets (hillshade, contours; references: frames 6, 11 and the grey contours in frame 5). They depend on the answer to Q1.
- Paper grain and texture (frames 3, 5). Not a vector style. Possible later as a CSS overlay.
- Further presets, in order of fit with the current work: Water Hero (a variant of Figure-Ground with water as the primary carrier; frame 8), Tri-tone (frame 4), Vintage Sepia (frame 12).
- Logo upload (7.9).
- "Swap ground" toggle for Single Ink.

## 10. Risks and caveats

- All percentages and the sample palettes are first guesses. Expect a tuning pass on real tiles.
- The mapping was designed from reference images and the token list, not from the style JSON. Layer-level details (urban landuse classes, building zoom range, casing layers) must be checked at implementation.
- Single Ink and Colour Field depend on automatic contrast correction. If it changes the user's colour too much, the result stops feeling "on brand". Worth testing with bright brand colours first.
- Time budget: keep this to the P0 test of three presets. Add presets only after the test shows the approach works.
