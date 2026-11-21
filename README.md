# SSpace

A 3D editor of galaxies, star systems and hex planets for tabletop campaigns. Electron + three.js; everything can be extended with mods.

**English** · [Русский](README.ru.md)

The interface is available in **English and Russian** (Settings → Windows and interface → Language, or View → Language).
Mods that ship their own translation switch along with the editor; the others stay in their own language.

## Download

From the [Releases](https://github.com/MaksMakovskiy/SSpace/releases) page (Windows, no installation — unzip and run `SSpace.exe`):

- **`SSpace-<version>-win-x64.zip`** — the editor without mods;
- **`SSpace-<version>-win-x64-full.zip`** — the editor with every mod;
- **`*.sspack`** — mods one by one: `all-mods.sspack` (all of them), `themes-pack.sspack` (themes and the wide interface)
  and one file per mod. Open a file in SSpace with “File → Open…” — the mods install and switch on by themselves
  (if a mod needs other mods, they are inside the same file).

## Share a project, mods and themes

“File → Share…” packs one `.sspack` file: a whole project, a set of mods, a set of themes — or everything together
(the project + the mods it needs to open properly + your theme). The recipient opens it with “File → Open…”,
sees what is inside, unticks what they do not want and installs it. Mods are programs: open bundles only from
people you trust.

## Build from source

```
npm install
npm run build     # dist/: portable versions without and with mods (.zip) and the mods (.sspack)
```

## Run

Double-click `SSpace.cmd`: on the first start it installs the dependencies itself. Or from a terminal:

```
npm install
npm start
```

Headless check (prints the editor console and exits): `npm run smoke`.

### Self-test, log and metrics

```
npm run selftest          # quick: ~20 s — all generators, windows, orbit, effects, space, saving
npm run selftest:full     # full: every parameter at its limits, big planets, ~30–60 s
node scripts/selftest.js quick orbit   # only tests with “orbit” in the name
```

Test runs use a separate temporary profile (your campaign and settings are not touched), print a summary and exit
with code 0 (all fine), 1 (errors) or 2 (did not finish); the full report is `selftest-report.json`.

In the editor: “Help → Log and metrics” (Ctrl+9) — live numbers (FPS, frame time, p95, draw calls, triangles,
memory), a filterable log, a table of measurements and the self-test button. The desktop version writes the log to
`<data folder>/logs/sspace-YYYY-MM-DD.log` (last 14 days).

For mods: `ss.log.info('my-mod', 'text', data)`, `ss.metrics.time('my-mod:step', () => …)`,
`ss.test.register({id, name, run: async (t) => { t.ok(…); t.eq(…); }})` — a mod's test shows up in the window and in `npm run selftest`.

## Folders

| Folder | What is there |
|---|---|
| `app/` | the editor itself (HTML, CSS, modules in `app/src`) |
| `app/packs/base.json` | the base set of terrains and markers |
| `app/src/i18n/` | the English dictionary of the editor and the English help |
| `packs/` | your sets — any `*.json` in the `sspace-pack` format |
| `mods/` | mods — a folder with `mod.json` and `main.js` (and optionally `i18n/en.json`) |
| `scripts/` | self-test, smoke run, build, string extractor for translations |

## How it works

All content lives in the registries `ss.reg.*`: `terrains`, `effects` (GLSL), `textures` (GLSL), `buildings`,
`poiKinds`, `generators`, `genLayers`, `tools`, `windows`, `dialogs`, `menus`, `themes`, `routeTypes`, `packs`.
Built-in content is registered through the same API as mods (`app/src/content/core.js`), so a mod can add,
replace or remove anything.

- `ss.hooks.on(name, fn)` — events (`frame`, `doc:loaded`, `doc:changed`, `palette:changed`, `tool:changed`, …) and filters (`cellInfo`).
- `ss.patch(obj, 'method', (orig, ...a) => …)` — wrap any core function.
- `ss.THREE`, `ss.scene`, `ss.view`, `ss.doc`, `ss.history`, `ss.ui` — direct access to everything.

A complete example of every extension point: `mods/example-moon/main.js`.

### mod.json

```json
{ "id": "my-mod", "name": "My mod", "version": "1.0.0", "main": "main.js",
  "api": 2,                    // the SSpace API version the mod is written for
  "requires": ["orbitals"],    // does not start without these and says which to switch on
  "optional": ["orbitals"],    // loads after them if they are on; works without them too
  "order": 0 }                 // fallback load order (dependencies always come first)
```

### Translating a mod

Put `i18n/en.json` into the mod folder — a map from the mod's own text to English:

```json
{ "Ледяная планета": "Ice planet", "Островов: {}": "Islands: {}" }
```

It is loaded automatically before the mod starts. A key with `{}` is a pattern (the parts in `{}` are translated too
if they can be). The translation is applied to the page as it is drawn, so the mod's code does not change; for text
drawn on a canvas use `ss.t(text)`. A mod written in English can ship `i18n/ru.json` the same way. To list a mod's
strings: `node scripts/i18n-extract.js mods/<folder> --missing mods/<folder>/i18n/en.json`.

### Interface for mods

Icons are named: `icon: 'flame'` (in generators, effects, orbit objects, windows, buttons); the current theme draws
them. A theme: `ss.reg.themes.register({id, name, vars: {'--accent': '#…'}, css, icons, iconTransform(svg), fx(ss) → cleanup, spaceRing})`.
A menu item with `bar: {icon, text, side: 'right', active()}` becomes a top-bar button; a big window with sections —
`ss.reg.dialogs.register({id, title, icon, side, sections: [{id, label, icon, render(pane)}]})` and
`ss.ui.openDialog(id, section)`; floating windows — `ss.reg.windows`.

In `activate(ss, mod)` there are `mod.has('orbitals')` and `ss.hasMod(id)`. Registries remember who added an entry
(`entry.source`). A switched-off mod does not damage planets: its orbit objects, effects, points and types stay in
the file and come back when the mod is switched on again. In-editor help: the “Help” menu (F1).

## Bundled mods

| Folder | What it adds |
|---|---|
| `mods/orbitals` | “Orbit”: rings, debris, patrol ships, stations, satellites, ring cities; free-place layout without overlaps; API `ss.orbit` |
| `mods/orbit-pack` | “Orbital arsenal”: 9 kinds of stations, 4 kinds of rings, asteroids, ice, junk, ship graveyard, mines, defence, satellite constellations, a moonlet |
| `mods/example-moon` | an example of every extension point; the “Moon” generator (no atmosphere), portals |
| `mods/ocean-world` | ocean world: number and size of islands, reefs, ports |
| `mods/radioactive` | radioactive world: the “Radiation” effect, crater holes, acid lakes |
| `mods/ghost-world` | ghost world: the “Ghost” effect, a translucent surface |
| `mods/inferno` | inferno world: the “Magma” and “Embers” effects, falling ash |
| `mods/winter` | winter world: the “Frost” effect, frozen seas, polynyas, snowfall |
| `mods/devastated` | devastated world: the “Smoulder” effect, crater holes, dried-up seas, dust storms |
| `mods/nanite-swarm` | nanite swarm: the “Nanites” effect, a world being consumed, a swarm cloud in orbit |
| `mods/machine-world` | machine planet: the “Circuits” effect, ringed towers, orbital rings |
| `mods/angels` | Planet of Angels: the “Radiance” effect, spires with energy rings, ring cities in orbit, nanite sparks |
| `mods/jungle` | jungle world: plants to choose (giant trees, mushrooms, ferns, spiral trees, lightbearers, tentacles), rivers, temples, fireflies |
| `mods/gas-giant` | gas giants: 6 palettes, bands, storms, polar cyclones, rings |
| `mods/shattered` | shattered planets: rifts to the core, breaches, shards in orbit |
| `mods/megastructures` | planet-sized stations: planet-ship, sphere station, the Burb (a black sphere with glowing seams and a port into the void) |
| `mods/settlements` | “Habitability”: an add-on for any generator — states and settlements of 10 eras, on land, in dangerous places and on water, roads, capitals |
| `mods/themes` | themes: Light, Midnight, Angels (nanites and silver), Angels: Glitch, Machines (amber HUD), Swarm (living chitin, beetles), Emoji — own colours, window shapes, icons, cursors and animations |
| `mods/wide-ui` | “Wide interface”: “Effects” and “Orbit” as big side panels (the planet stays visible), a draggable orbit map, catalogues of cards, multi-column windows; works with any theme |

A generator can set the atmosphere (`atmosphere: {on, color}` or `ctx.atmosphere()`) and a “look” for mods
(`look: {...}` or `ctx.look()`, stored in `doc.meta.look`). Particles around a planet by look:
`ss.particles.forLook('snow', {name, icon, mod, motion: 'fall' | 'rise' | 'orbit' | 'drift', colors, count, …})`.
All such effects show up in the “Effects” window (Ctrl+7), where they are switched on and tuned per planet.

## World generator

“World generator” (Ctrl+8) is a big gallery: cards with a real preview of every generator, search and groups; on
the left the settings of the chosen world, add-ons (habitability and so on) and a spinning preview.
A generator describes itself for the library with `icon`, `group`, `desc`, `preview: ['#colour', …]`.
Parameters: a slider `{id, name, min, max, value, unit}`, a tick `{type: 'check', value: true}`, a list
`{type: 'select', options: [{value, label}]}`; `section: 'Plants'` groups parameters under a heading.
Generation add-ons (`ss.reg.genLayers.register({id, name, params, run(ctx), confirm(gen)})`) work on top of any
generator. The last generation is remembered in the planet (`doc.meta.gen`); Ctrl+G — another variant.

## Levels

Universe (galaxies) → Galaxy (a particle core, sectors “rings × wedges”, star systems) →
Star system (a star, planets on orbits) → Planet (the hex map editor). Routes are drawn between galaxies, systems
and planets; their types are in `ss.reg.routeTypes`. Ctrl+F searches everything; any planet, system or sector can be
marked with a coloured flag.

## Files

`*.sspace` — a campaign file: the whole universe with the planet maps. `*.sspack` — a bundle of a project, mods
and/or themes. A single planet file or an old “Hex Planet” file opens into the current star system (or a new campaign).

## License

© 2026 Maksym Makovskyi (Snvok, [GitHub](https://github.com/MaksMakovskiy)). Released under the MIT License — see [LICENSE](LICENSE).

In short: you may use, copy, modify, embed and distribute SSpace and its mods, including commercially. The only
condition is to keep the author notice (“Copyright (c) 2026 Maksym Makovskyi (Snvok)”) and the license text in all
copies and derivatives. The software is provided “as is”, without warranty.
