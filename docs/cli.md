# CLI and pipeline

You rarely run these yourself: the skill tells your agent when to. They're useful for scripting, CI and debugging. Every command prints exactly one line of JSON.

```bash
SC="node skills/seecode/scripts/seecode.mjs"
```

## How a diagram gets made

```
request ─▶ where will it live? ─▶ pick a type ─▶ JSON spec ─▶ render ─▶ HTML ─▶ export
            (delivery dials)      (INDEX.md)      (agent)        │  ▲
                                                                  ▼  │ one-line problems + fix hints
                                                                patch
```

1. **Delivery intake.** The agent infers the destination, look, size and audience from the request. It asks one question only when the answer is unclear and would change the output ([delivery.md](../skills/seecode/references/delivery.md)).
2. **Spec.** The agent reads the guide for the chosen type only (at most 1.5 KB) and writes a compact JSON spec with coarse placement such as `row`/`col`.
3. **Render.** `render` validates the spec, lays it out, routes edges, assigns animation steps, checks label collisions and the complexity budget, and writes one HTML file.
4. **Fix.** Problems come back as short codes (`E_…` errors, `W_…` warnings) with a fix hint. The agent applies a small `--patch` and re-renders, never reading the HTML.
5. **Export.** `export --for <destination>` produces the right files for where the diagram is going.

## Commands

| Command | What it does |
|---|---|
| `render <spec.json> [--patch '<json>'] [--motion <preset>] [--out <file>]` | Validate the spec and write the HTML diagram |
| `validate <spec.json>` | Run the checks only |
| `types` | List diagram types and variants |
| `export <x.html> --for <destination>` | Export for a destination: `pdf`, `print`, `docs`, `word`, `gdocs`, `notion`, `confluence`, `readme`, `slides`, `gslides`, `figma`, `social`, `video`, `animated` |
| `export <x.html> --formats svg,png,gif,mp4` | Export specific formats (also `jpeg`, `webp`, `webm`); see [export.md](../skills/seecode/references/export.md) for every flag |
| `import <file>` | Turn Mermaid, Graphviz, PlantUML, D2, draw.io, Excalidraw, Structurizr, BPMN, SQL, Prisma, DBML, OpenAPI or CSV/JSON into a draft spec |
| `scan [dir] [--depth 2]` | Compact repository summary (modules, imports, tech, infra, with `file:line`) for diagrams of real code |
| `config status` | Effective settings, and whether this is the project's first run |
| `config init --use global\|project` | Answer the first-run question |
| `config set <key> <value> [--global]` | Change one setting |
| `brand <url\|dir>` · `brand --colors "#hex,#hex,…"` `[--fonts "sans=…,serif=…,mono=…"] [--save <name> --use]` | Learn a brand palette and typefaces from a site, project files or a list; prints light and dark palettes, fonts, contrast fixes and where each came from ([onboarding.md](../skills/seecode/references/onboarding.md)) |
| `config profile save <slug> --accent #hex [--use]` · `config profile list` | Set brand roles by hand · list profiles |
| `doctor` | Check Node, the bundled encoders, and the browser used for PNG, GIF and MP4 export |

## Patching

`--patch` takes a JSON merge patch. Arrays of objects are keyed by `id`, so you can change a single node:

```bash
$SC render checkout.json --patch '{"nodes":{"api":{"col":3,"focal":true}}}'
```

Set a key to `null` to remove it, or add a node by giving a new id. Edges are added or removed as tuples:

```bash
$SC render checkout.json --patch '{"edges":{"add":[["api","cache","read"]],"remove":["api>db"]}}'
```

## Settings

Settings come from, in order: the request, then `<project>/.seecode/config.json`, then `~/.seecode/config.json`, then the defaults. See [settings.md](../skills/seecode/references/settings.md) for every key.
