# Settings

- **Global:** `~/.seecode/config.json`.
- **Project:** `<repo>/.seecode/config.json`. This is either `{ "inherit": "global" }` or a full set of settings.
- **Priority:** spec / flags, then project, then global, then defaults.

| Key | Default | Meaning |
|---|---|---|
| `skin` | `light` | `light`, `dark` or `terminal` |
| `motion` | `auto` | The default preset |
| `exportFormats` | `["html","png"]` | What to export when the user doesn't say |
| `size` | `auto` | Page width preset |
| `scale` | `auto` | Raster export scale: `auto` sizes from the content, a number is a target |
| `fps` | `30` | GIF/MP4 frame rate |
| `duration` | `auto` | GIF/MP4 length: `auto` (reveal plus one token loop) or a number of seconds |
| `outputDir` | `diagrams` | Where specs and HTML are written |
| `profile` | `null` | A brand profile slug from `~/.seecode/profiles/<slug>.json` |
| `watermark` | `true` | SeeCode logo in each diagram's bottom-right corner; `false` removes it (only when the user asks) |

**Commands**
- `SC config status`
- `SC config init --use global|project`
- `SC config set <key> <value> [--global]`

**First run:** when `status` returns `state:"first-run"`, ask the user once, then run `init`.

**Brand profile:** usually written by `SC brand … --save <name>` (see `onboarding.md`): `{"brand":{"paper","ink","accent","link"},"dark":{…},"source":"…"}`. With `paper` and `ink` set, all other surfaces are derived from them. Every key is optional.
