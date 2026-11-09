# Spike: can Liberty reach the three preset looks?

M3 Part A, 2026-11-09. **Result: go on Liberty for all three presets.** No own style template is needed.

The method: the spec 5.5 sample palettes, hand-tuned colours, and Liberty patched directly as JSON ([scripts/spike-presets.ts](../../scripts/spike-presets.ts)), on real OpenFreeMap tiles. Captured for Zurich, Kyiv and Lisbon at z8, z12 and z16 ([scripts/spike-capture.mjs](../../scripts/spike-capture.mjs)). Tile contents were measured by decoding the centre tile per city and zoom ([scripts/spike-tiles.mjs](../../scripts/spike-tiles.mjs)).

| Preset | Sheet | Verdict |
| --- | --- | --- |
| Single Ink | [sheet](presets-feasibility/sheet-single-ink.png) | **Go.** Solid ink water, medium major roads, hairline minor roads and Paper water labels all work. Reads like frame 2. |
| Figure-Ground | [sheet](presets-feasibility/sheet-figure-ground.png) | **Go, with one added layer.** Fabric blocks with paper road gaps at z12 and footprints at z16. No empty zoom. |
| Colour Field | [sheet](presets-feasibility/sheet-colour-field.png) | **Go.** Land is the saturated field, roads are tonal, and water is the deep colour. |

The Figma file "Branded maps" is not linked from the repo, so I compared against the spec's descriptions of the frames, not the frames themselves.

## What the tiles hold

Share of the centre tile's area, from the decoded tiles:

| | z8 | z10 | z12 | z13 | z14 |
| --- | --- | --- | --- | --- | --- |
| Zurich: residential + commercial + industrial + retail | 7% | 23% | 43% | 66% | 68% |
| Kyiv: same classes | 8% | 29% | 37% | 55% | 46% |
| Lisbon: same classes (tile is mostly water) | 2% | 12% | 14% | 46% | 73% |
| Buildings, all three | 0 | 0 | 0 | 18-25% | 20-41% |

- **`building` first draws at z13.** At z13 the tile holds one merged building feature, and real footprints arrive at z14. Liberty has `building` from z13 to z14 and `building-3d` from z14, and both are flattened already.
- **Urban landuse exists at every zoom.** `residential` comes from z6 (Natural Earth urban areas at low zoom, one merged feature per tile). `commercial`, `industrial` and `retail` come from z10.
- **`suburb`, `quarter` and `neighbourhood` must not carry Fabric.** OpenFreeMap puts place polygons in `landuse`. They overlap and blanket whole cities (Zurich z12: 160% of the tile), lake included.
- **Liberty's own `landuse_residential` stops at z12** and is semi-transparent. Liberty has no commercial or industrial fill. So Figure-Ground needs one added layer: an opaque fill on the four classes that fades out between z13 and z14.5, as buildings take over. With it, Figure-Ground is not empty below z13 (see z8 and z12 on the sheet).

## Roads

Liberty's widths are fixed in the style JSON, but the compiler rewrites that JSON, so widths are only a default. The spike overrode them:

- **Single Ink:** major roads on a "medium" ramp (1.8 px at z12, 3.5 at z16), minor roads on a "hairline" ramp (0.4-1 px), and casings removed.
- **Figure-Ground:** Liberty's widths kept. Major casings are the fill's own ramp plus 1.2 px, so they hug the road as a hairline. Paper roads read as gaps inside Fabric at z12 and z16. On open land they rely on the casing (see Kyiv z16, the square).
- **Colour Field:** Liberty's widths, casings removed. Tonal and legible at z12 and z16.

Casings, widths, dashes and the added layer are all plain style JSON. That is the compiler extension the brief anticipated, not a new template.

## Token to layer mapping

| Token | Liberty layers |
| --- | --- |
| `urbanLanduse` | New layer `b2b_urban_landuse`, inserted after `landuse_residential`: `landuse` classes `residential`, `commercial`, `industrial`, `retail`, opaque, fading out from z13 to z14.5. Liberty's own `landuse_residential` stays under the "Land use" toggle. |
| `roadMajorCasing` | `*_casing` layers of motorway, trunk/primary, secondary and links, including tunnel and bridge variants. Tertiary casings stay with minor roads (the existing split). |

## Sprites

They do not matter for these presets. All three default POIs off. The baked sprites still visible are the city dot up to z9, highway shields (medium label density, so off at the Low default) and one-way arrows at z16 (grey, small). None of them clash in the captures.

## Decision rule

All three presets are reachable on Liberty, so Part B continues on Liberty. An own template would only pay off if Liberty's layer stack blocked a look, and nothing here did.
