# Brief for Claude Code: M3 Presets (spike + preset engine)

**Project:** Brand-to-Basemap, P0 prototype
**Milestone:** M3, from "brand colours to tokens" to "presets: recipes that decide where the key colour goes"
**From:** PM chat (owner: Artem)
**Source of truth for the presets themselves:** `docs/presets-design-spec.md` (v0.1). This brief says what to build first, and changes six things in that spec (section 2). Where this brief and the spec disagree, this brief wins.
**Status labels:** **[DECIDED]** is confirmed by Artem. **[PM DEFAULT]** is a proposal: build on it, keep it easy to change, flag it in your report.

---

## 1. Why this exists

Checkpoint A2 showed that the current engine makes every brand look alike: the key colour only recolours roads, and land, water and park stay pale tints. Artem's vision is a map that is beautiful in a couple of clicks, like the 12 reference frames in the Figma file "Branded maps". Presets fix this structurally: each preset says which map features carry which key colour.

**Acceptance rule from the spec:** the primary key colour must land on at least one *area* token (land, water or built-up fabric) in every preset, never on roads alone.

## 2. Changes to the spec [DECIDED]

1. **Only the primary colour is required.** Every other slot is optional ("refine") and has a derived default, so one colour always gives a full, good-looking map. The spec's "required, default none" slots in Figure-Ground (Water, Paper) get derived defaults. Primary slot per preset: Single Ink = Ink, Figure-Ground = Fabric, Colour Field = Field.
2. **Add a `treatment` block to the preset format.** Weights (medium, hairline), casings, dashes, which layers are locked and water-label colour are not colour tokens. The style compiler is extended for `urbanLanduse`, `roadsMajorCasing`, widths and dashes; "no compiler change" in the spec is not true.
3. **Contrast thresholds are per preset**, and each check names the ground it measures against. Starting values, tune and report: Single Ink roads vs Paper: major 3:1, minor 1.5:1. Figure-Ground: paper roads vs Fabric inside built-up areas and the casing vs Paper on open land. Colour Field is tonal by design: major 1.5:1, minor 1.2:1 against Field, not 3:1. Labels stay at 4.5:1 against what they sit on in all presets. Auto-fix never changes a key colour the user typed; the UI later shows "used: #xxxxxx" next to it.
4. **Liberty only for presets in P0.** Streets v2 and the provider switch wait.
5. **No live preset thumbnails.** Static thumbnails from each preset's sample palette come in the app step, not here.
6. **Data mode is verified, not assumed.** It should work on all three presets without preset code, but its sliding road threshold may fight Figure-Ground's paper roads. Check it and report.

Also **[DECIDED]:** Dark mode is out. Hide the Dark option while presets are on; do not delete the dark code. Data tiles are **OpenFreeMap only** (OpenMapTiles schema; no terrain, contours or hillshade).

## 3. Part A, spike (1-2 hours, do first)

Question: can OpenFreeMap **Liberty**, recoloured and with toggles, reach the three looks in the spec, or do we need our own compact style template (about 30 layers on the OpenMapTiles schema, with all widths and fills under our control)?

Find out, on real tiles, for Zurich, Kyiv and one more city:
- At which zoom the `building` layer first draws, and which `landuse` classes exist at z8-z12 (can urban landuse carry the Fabric colour so Figure-Ground is not empty below z13?).
- Whether Liberty's road layers allow what Figure-Ground needs: paper-coloured roads reading as gaps inside Fabric, with a hairline casing on major roads. Widths are fixed by Liberty, so check whether the result is legible at z12 and z16.
- Whether Single Ink works: water as a solid Ink fill, hairline minor roads, medium major roads, water labels in Paper.
- Which Liberty layers the new tokens (`urbanLanduse`, `roadsMajorCasing`) map to.
- Whether the Liberty sprites (POIs) matter here. All three presets default POIs off.

Quick mock-ups are enough: take the three sample palettes from spec 5.5, hand-tune a style, screenshot at z12 for Zurich. Compare against the reference frames (Single Ink: frame 2; Figure-Ground: frames 5, 7, 9, 10; Colour Field: frames 1, 3).

**Deliverable:** `docs/spikes/presets-feasibility.md` with screenshots, a go or no-go on Liberty recolour for each preset, and the mapping list. **Decision rule:** if all three presets are reachable on Liberty, continue. If one or more are not, state what an own style template costs. If you estimate it at more than one working day, stop and report to Artem. If less, continue with it and say so.

## 4. Part B, preset engine

Build on the existing pure-function core (OKLCH via `culori`, gamut mapping by chroma reduction, tunables in one config file, tested).

### 4.1 Pipeline

```
primary + optional slot values -> preset resolve (expressions, derived defaults)
  -> per-preset auto-fix (checks) -> per-token overrides -> data transform (Light + Data only)
  -> applyTokens / style compiler
```

The old per-mode transform and dark path stay in the repo but are not wired while presets are on. The resolved token set is the existing one plus `urbanLanduse` and `roadsMajorCasing`; Data mode reads the resolved tokens as before.

### 4.2 Preset format

One JSON file per preset in `presets/`, loaded by id, following spec section 6 plus:
- `slots` with `primary: true` on one slot and a `default` expression on every other.
- `treatment`: road weights, casing, boundary dash, water-label colour, accent outline.
- `lockedDetails` and `detailDefaults`.
- `checks`: names plus per-preset thresholds and the named ground (section 2, item 3).

Expression functions: `mix(a, b, n)`, `dark(x)`, `light(x)`, `complement(x)`, all in OKLCH. The spec's percentages are starting values.

### 4.3 Derived defaults [PM DEFAULT]

Single Ink and Colour Field defaults are in the spec. For Figure-Ground, from Fabric alone: Paper = near-white tint at the Fabric hue (L about 0.97, C about 0.01); Water = a hue roughly opposite or at least 90 degrees from Fabric, with lightness and chroma set so the carrier-separation check passes; Green = Paper. Judge by looking: if the derived Water looks bad on several palettes, tune the rule and report it.

### 4.4 State

`BrandState` version bump: preset id, slot values (only user-set ones), overrides per preset, recede value. Still JSON-safe and versioned. Switching preset keeps the primary colour; other slots reset to the new preset's defaults; overrides are cleared.

### 4.5 Test inputs

- The three sample palettes from spec 5.5.
- Both problem palettes: terracotta/cream/green/navy (`#C65D3B, #E9D8C4, #5B6B4F, #2E3A59`) and cyan/magenta (`#00F0FF, #FF2BD6`), each in all three presets.
- **Primary only** on the 10 existing fixture palettes, in all three presets, to test the derived defaults.
- A bright-brand check on Single Ink (neon cyan), where auto-fix must darken the carrier without losing the brand feel.

## 5. Deliverables

1. Code and tests: preset resolver and expression evaluator, the three preset files, derived defaults, per-preset checks and auto-fix, compiler extensions, and the state change. Unit and property tests: determinism; valid in-gamut hex; the primary colour appears on an area token in every preset; checks pass or auto-fix runs and reports; overrides clear on preset change; data mode runs on all three presets.
2. **Contact sheets** in `docs/screens/m3/`, scannable at a glance:
   - 3 presets x 3 palettes (sample, terracotta, cyan/magenta) x Zurich, Kyiv and one more city, at z4, z8, z12 and z16.
   - One overview per preset of the 10 fixtures with primary only, at z12.
   - Data mode on each preset at recede 60.
3. **`docs/preset-engine.md`**: the rules, the preset format, the tunables and known limits.
4. **Variability check**: one sheet with the same palette across the three presets and one with the same preset across five palettes. They must be recognisably different at thumbnail size.
5. **Report** to Artem.

## 6. Acceptance criteria

- [ ] Spike done, with a clear go or no-go.
- [ ] Each preset renders for Zurich and two other cities at z4, z8, z12 and z16 with no broken or empty-looking zoom.
- [ ] The primary colour lands on at least one area token in every preset.
- [ ] With the same palette, the three presets produce visibly different maps; with different palettes, the same preset also differs.
- [ ] All label and road checks pass at the defaults, or auto-fix runs and the notice is recorded.
- [ ] Data mode works on all three presets. State what, if anything, needed changing.
- [ ] Every number is in config or the preset files.

## 7. What to report back

1. Spike result and the decision rule outcome.
2. Links to the contact sheets.
3. Weakest preset and palette combinations, and what you tried.
4. Rules you changed from the spec, with evidence.
5. Open questions for Artem or the PM, each with your recommendation.

## 8. Working agreements

- **Judge by looking.** Review your sheets critically before showing them. If a preset looks dull next to its reference, fix the rule, not the test.
- **The app UI is a proof of concept.** Do not polish layout, thumbnails or copy. The app step comes after Checkpoint A3.
- The earlier S2 fixes (z16 empty at default toggles, overlay removed, housekeeping, merge and deploy) are folded into the app step after this milestone, unless already done.
- Small commits, no secrets, keep `docs/` current. Update `CLAUDE.md` and `docs/p0-requirements.md` with the preset decisions.
- **Pace.** Target a reviewable result within one working session. Artem's next touchpoint is Checkpoint A3: reviewing the contact sheets (about 15 minutes).
