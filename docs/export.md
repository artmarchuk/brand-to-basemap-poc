# Export, share and tile sources (M4)

How the prototype hands a map over: the two export files, the data anchor layer, key handling, the share link and autosave, and the two tile sources. Brief: [briefs/m4-export-state.md](briefs/m4-export-state.md).

## The two outputs

The **Export** button in the header opens the export panel at any time. It shows what is on the map now and offers each output with **Copy** and **Download**.

| Output | What it is | Code |
| --- | --- | --- |
| **Embed snippet** (`map.html`, about 60 KB) | A complete HTML page. It loads `maplibre-gl@6.16.0` from unpkg (ES module build), inlines the style, opens at the current centre and zoom, and shows the attribution expanded (`attributionControl: { compact: false }`). With MapTiler it also adds the MapTiler logo. Paste it into an empty `.html` file and open it. | `exportSnippet` in [src/export/export.ts](../src/export/export.ts) |
| **Style JSON** (`style.json`, about 140 KB) | A self-contained MapLibre style (version 8) for the current state: preset, primary, typed slots, overrides, Data mode and recede, detail toggles. Attribution is set on the vector source. `metadata["b2b:export"]` records the preset, primary, mode and source, with notes on the anchor and the key. | `exportStyle` in the same file |

Both are built from the same compiled style as the map in the app (`compileBrand` in [src/app/compile.ts](../src/app/compile.ts), then `withTileSource`). A test checks that the app and the export compile the same layers. No overlay or test data is ever exported.

**Data mode:** the exports use the current mode. In Data mode they carry the receded colours and the label holds at the current recede value. Hidden POIs and thinned labels stay hidden in the export.

## Data anchor layer

Every compiled style contains one extra layer, **`b2b-data-anchor`**. It is an invisible `background` layer (`visibility: none`) that draws nothing and only marks a position. It sits after the last fill or line layer (land, landuse, water, parks, roads, buildings, boundaries) and before the first label layer, so all labels, road names, POIs and shields are above it.

To put your data between the base map and the labels:

```js
map.on('load', () => {
  map.addSource('mine', { type: 'geojson', data });
  map.addLayer({ id: 'mine', type: 'fill', source: 'mine', paint: { 'fill-color': '#0af' } }, 'b2b-data-anchor');
});
```

The snippet includes this as a comment. Tests:
- [tests/export.test.ts](../tests/export.test.ts) checks the anchor's position in every preset, in Light and Data mode, and the layer order after an insert with `beforeId`.
- [scripts/check-export.ts](../scripts/check-export.ts) renders it. It adds a full-view red GeoJSON fill with `beforeId: 'b2b-data-anchor'` in the exported page, then checks that the fill covers land, water and roads (about 99% red) and that the labels still draw on top. Screens: [anchor-openfreemap.png](screens/m4/anchor-openfreemap.png), [anchor-maptiler.png](screens/m4/anchor-maptiler.png).

## Key handling

- **OpenFreeMap** needs no key and none is involved.
- **MapTiler**: the user pastes their own key in the Tiles panel. It is stored in localStorage (`b2b:maptilerKey`) only. It is not part of the app state, so it never reaches the share link, the autosave or an export by default.
- In exports, MapTiler URLs carry the placeholder `YOUR_MAPTILER_KEY`. The snippet declares it once, `const MAPTILER_KEY = 'YOUR_MAPTILER_KEY'`, and swaps it into each request with `transformRequest`, so the key goes in one place. The style JSON has the placeholder in the tile and glyph URLs, and a note in its metadata.
- **"Include my key"** is an explicit opt-in checkbox in the export panel. It is off every time the panel opens and stays off until ticked. When ticked, the panel warns not to share the files publicly and suggests restricting the key to a domain at cloud.maptiler.com.
- The deployed app ships no key. `npm run build` still runs [scripts/check-no-keys.mjs](../scripts/check-no-keys.mjs), which fails if the personal key, a `key=` URL with a real-looking key, or the MapTiler Streets style reaches `dist/`.

## Share link and autosave

- The state is `BrandState` version 3 ([src/app/brandState.ts](../src/app/brandState.ts)): `primary`, `presetId`, `perPreset` (typed slots and overrides per preset and mode), `mode`, `recede`, `details`, `density`, `source` and `view` (centre and zoom). It is plain JSON.
- **Hash:** `#s=` plus base64url-encoded JSON, about 300-450 characters. It updates 300 ms after any change, including when the map stops moving. Opening the link in a fresh browser restores the same map and view.
- **Autosave:** the same JSON in localStorage (`b2b:state`), restored on load. A hash in the URL wins over autosave.
- **Bad input:** an unreadable, old-version or invalid hash loads the defaults with a short notice and never crashes. A damaged autosave does the same. Parsing rebuilds the state field by field, so unknown fields (a pasted key, for example) are dropped. Out-of-range numbers are clamped.
- If someone pastes a different link into an open tab, the page reloads with it.
- The source choice is shared, the key is not. A link with `source: maptiler` opened without a key shows the map on OpenFreeMap, and the Tiles panel asks for a key.

## Tile sources

Both sources serve the OpenMapTiles schema, version 3.16, so the compiled Liberty-based style works on either by swapping the vector source and glyph URLs ([src/style/source.ts](../src/style/source.ts)).

| | OpenFreeMap (default) | MapTiler |
| --- | --- | --- |
| Vector tiles | `tiles.openfreemap.org/planet` | `api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=…` |
| Fonts | `tiles.openfreemap.org/fonts` | `api.maptiler.com/fonts` (Noto Sans Regular, Bold and Italic all present) |
| Sprite | OpenFreeMap `ofm_f384` | **The same OpenFreeMap sprite** (see limits) |
| Attribution | OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors | © MapTiler, © OpenStreetMap contributors |
| Logo | none | MapTiler logo bottom left, linking to maptiler.com (required on the free plan) |

Liberty's unused natural-earth relief raster is dropped from both, because no visible layer reads it.

**Comparison** ([scripts/compare-sources.ts](../scripts/compare-sources.ts)): each preset's sample palette, Zurich, z4, z8, z12 and z16, on both sources. Sheets: [Single Ink](screens/m4/sources-single-ink.png), [Figure-Ground](screens/m4/sources-figure-ground.png), [Colour Field](screens/m4/sources-colour-field.png); the counts are in [source-differences.md](screens/m4/source-differences.md). The two render the same layers. Rendered labels are identical at every stop, and feature counts differ by 1-2 features in a few layers (parks at z12; paths and buildings at z16), which are data-build differences. No layer is missing, and no fonts or schema fields differ in a way the style reads. MapTiler's TileJSON does not list `name_en` or `name_de`, but its tiles carry them: "Tyrrhenian Sea" renders on both.

## Known limits

- **Sprite from OpenFreeMap on MapTiler.** Liberty's icon names (POIs, shields, one-way arrows) exist only in the OpenFreeMap sprite, so the MapTiler export still loads it from `tiles.openfreemap.org`. MapTiler's own sprites use other names. An alternative is to host the sprite with the app.
- **MapTiler free plan terms**: free use is limited to non-commercial use and R&D, with 100k requests and 5k sessions a month. The logo and the "© MapTiler" credit must stay visible. See the report for the open question.
- **The snippet depends on unpkg.** It pins `maplibre-gl@6.16.0`. A self-hosted copy works too: change the two URLs at the top.
- **Not in the exports yet:** the token set as JSON or CSS variables (F6 in the requirements). The M4 brief asked only for style JSON and the snippet.
- **Light and Data mode are exported one at a time**, whichever is on. There is no single file with both.
- MapTiler keys restricted to an HTTP origin block `file://` pages: open the snippet from a local server, or allow `localhost` on the key.
