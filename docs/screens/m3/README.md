# M3 contact sheets

Captured with `npx tsx scripts/capture-m3.ts <server>/harness/presets.html` on real OpenFreeMap tiles, Liberty, at each preset's default detail. Raw captures are gitignored; [checks.json](checks.json) holds the slots used, checks and auto-fix notices for every Zurich z12 shot.

**A3 tweaks and references:** [Single Ink labels, before and after](tweak-single-ink-labels.png), [Colour Field roads, Spark and buildings, before and after](tweak-colour-field-roads-spark-buildings.png). Side-by-side with the Figma reference frames (local only, not committed): `reference-single-ink.png`, `reference-figure-ground.png`, `reference-colour-field.png`. The app in headless Chrome: [app/](app/).

**Start here (about 15 minutes):**

1. [Same palette, three presets](variability-one-palette.png) and [same preset, five palettes](variability-one-preset.png)
2. The sample palettes: [Single Ink](single-ink-sample.png), [Figure-Ground](figure-ground-sample.png), [Colour Field](colour-field-sample.png)
3. [Data mode at recede 60](data-mode-recede-60.png)

**Every preset × palette, Zurich, Kyiv and Lisbon at z4, z8, z12 and z16:**

| | Sample | Terracotta | Cyan/magenta | Primary only, 10 fixtures (z12) |
| --- | --- | --- | --- | --- |
| Single Ink | [sheet](single-ink-sample.png) | [sheet](single-ink-terracotta.png) | [sheet](single-ink-cyan-magenta.png) | [sheet](single-ink-fixtures-primary-only.png) |
| Figure-Ground | [sheet](figure-ground-sample.png) | [sheet](figure-ground-terracotta.png) | [sheet](figure-ground-cyan-magenta.png) | [sheet](figure-ground-fixtures-primary-only.png) |
| Colour Field | [sheet](colour-field-sample.png) | [sheet](colour-field-terracotta.png) | [sheet](colour-field-cyan-magenta.png) | [sheet](colour-field-fixtures-primary-only.png) |

The problem palettes are assigned to slots by role ([fixtures/preset-palettes.json](../../../fixtures/preset-palettes.json)): terracotta is Ink/Paper, Fabric/Paper/Water (navy)/Green (olive), and Field/Deep (navy)/Ink (navy)/Spark (cream); cyan/magenta is Ink, Fabric/Water and Field/Deep.
