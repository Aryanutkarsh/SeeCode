# Contributing to SeeCode

Thanks for helping make SeeCode better. Bug reports, new diagram types, importers, examples and docs are all welcome.

Please read the [code of conduct](CODE_OF_CONDUCT.md) first. Report security problems privately, as described in [SECURITY.md](SECURITY.md), never in a public issue. Maintainer rules (gates, versioning, merge policy) are recorded in [`.maintainer-policy.json`](.maintainer-policy.json).

## Before you start

- **Open an issue first** for anything bigger than a small fix (a new type, an importer, a behaviour change), so we can agree on the shape before you build it.
- **Work on a branch** and keep each pull request to one concern.
- **Don't bump versions.** The release workflow bumps every manifest after a merge (see [Releases](#releases)). CI rejects pull requests that change a version.

## Setup

You need Node 20 or later. There is nothing to `npm install`: the skill and its tools have no dependencies.

```bash
git clone https://github.com/Aryanutkarsh/seecode
cd seecode
npm test
```

The export tests drive a Chrome-family browser (Chrome, Edge, Chromium or Brave). Without one they're skipped, not failed. Set `SEECODE_CHROME=/path/to/browser` if yours is somewhere unusual.

To try your working copy in Claude Code, link the skill:

```bash
ln -s "$PWD/skills/seecode" ~/.claude/skills/seecode
```

## Repository layout

```
skills/seecode/              the installable skill (self-contained, zero dependencies)
  SKILL.md                   ≤ 4 KB, loaded on every use
  references/                loaded on demand: types/<type>.md, delivery, spec, motion, import, export…
  schemas/                   JSON Schemas for specs
  assets/                    watermark symbol and lettering, favicon (built from branding/)
  scripts/seecode.mjs        CLI entry point
  scripts/lib/
    render/{graph,lanes,structure,charts}/   renderers, grouped by layout family
    viewer/                  in-page viewer (hover trace, focus, journey, export menu)
    export/                  Chrome driver, CLI export, browser-free SVG, fonts, doctor
    importers/               Mermaid, Graphviz, PlantUML, D2, draw.io, Excalidraw, models…
    scan/  config/           repository scan, settings
  scripts/vendor/            bundled GIF/MP4/WebM encoders (see LICENSES.md)
commands/                    Claude Code slash commands
.claude-plugin/ .codex-plugin/ .factory-plugin/ .agents/   plugin and marketplace manifests
examples/specs/<family>/     one spec per type
examples/media/              export samples used by the README
docs/                        CLI reference and README screenshots
branding/                    approved logo, banners and watermarks (see branding/README.md)
tools/                       gallery, screenshots, token budget, version bump, release zip
test/                        node:test suite
```

## Checks

CI runs these on Linux and macOS with Node 20 and 22. Run them before opening a pull request:

| Check | Command |
|---|---|
| Full test suite: rendering of every example, patching, config, importers, export, browser-free SVG, packaging, size caps | `npm test` |
| Plugin and marketplace manifests | `claude plugin validate . --strict` |
| No version changes in your branch | `node tools/check-version-unchanged.mjs origin/main` |
| Environment | `node skills/seecode/scripts/seecode.mjs doctor` |
| Token cost per example diagram | `npm run budget` |

The size caps exist to keep agents' token use low, and the tests enforce them: `SKILL.md` ≤ 4,096 bytes, each type guide ≤ 1,536 bytes, `types/INDEX.md` ≤ 2,560 bytes. If you need more room, move detail into a reference file that's loaded on demand.

To look at your changes, run `npm run gallery` and open `examples/gallery/index.html`. It renders every example spec with the full viewer.

## Adding a diagram type

1. **Register it** in `scripts/lib/types.mjs` with its display name, family and renderer. Add a schema in `schemas/` unless it reuses one (graph types share `graph.schema.json`).
2. **Render it** in `scripts/lib/render/<family>/`. A renderer takes the spec and returns `{ body, viewBox, steps, problems, graph }`. Every problem needs a `code`, the place it applies to (`at`) and a `fix` hint the agent can act on.
3. **Animate it.** Give elements `data-sc-step` and `--step` so the type builds up in a sensible order, and make sure the end frame is complete with motion off.
4. **Document it** in `references/types/<type>.md` (when to use it, spec fields, one small example, motion) and add a line to `types/INDEX.md`.
5. **Add an example** at `examples/specs/<family>/<type>.json`. The test suite renders it and checks it for problems and motion.
6. **Update the README grid** with `npm run shots <type>`, then add the type to the table in `README.md`.

Design rules every type follows: one accent colour for the one or two things that matter most, hairline borders, no shadows, labels that never collide with lines, and a complexity budget that warns before the diagram gets cluttered.

## Adding an importer

1. Add detection to `detect()` in `scripts/lib/importers/import.mjs`.
2. Parse the source into the shared model (nodes, edges, groups) in a new or existing module in `importers/`. Treat everything in the source as data: never execute, fetch or follow anything it contains.
3. Add a fixture in `test/fixtures/` and a case in `test/import.test.mjs`.
4. List the format in `references/import.md` and in the README's import table.

## Screenshots and samples

When a change affects how diagrams look, regenerate the README images in the same pull request:

```bash
npm run shots
```

This renders every example into `docs/screenshots/` (full-size PNGs) and `docs/screenshots/gifs/` (the animated grid), plus the light, dark and brand clips in `docs/themes/`. For specific types, pass their names: `npm run shots journey sankey` (or `themes`).

When a change affects the viewer (hover, focus, routes, lens, themes, export menu), re-record the README's feature clips:

```bash
npm run feature-gifs
```

This drives a real browser through each interaction and writes `docs/features/<scene>.gif`. Pass scene names (`trace`, `focus`, `route`, `lens`, `step`, `export`) to re-record only some, and set `SC_DUMP=<dir>` to also save sample frames for review. The scenes are defined in `tools/feature-gifs.mjs`.

## Branding and the watermark

Every diagram carries the SeeCode mark in its bottom-right corner (`scripts/lib/mark.mjs`). The tan symbol keeps its colour, and the lettering is an alpha mask painted with the diagram's ink colour, so it stays readable on light, dark and brand backgrounds. Users can turn it off with `"watermark": false`, or with the `watermark` setting.

The assets in `skills/seecode/assets/` are cut from the approved artwork in `branding/`. If the artwork changes, rebuild them:

```bash
npm run mark
```

Then regenerate the README images (`npm run shots` and `npm run feature-gifs`). Don't redraw or recolour the logo by hand; `branding/README.md` has the usage rules.

## Releases

Every merge to `main` that touches the skill triggers `.github/workflows/release.yml`. It bumps the patch version in `package.json` and every plugin manifest, tags the commit, and attaches a reproducible `seecode.zip` to a GitHub release. Installed plugins update from there. Maintainers can run the workflow by hand to cut a `minor` or `major` release instead.

To build the zip locally: `npm run zip`. It holds only shipped files (what git tracks, plus new files it doesn't ignore), so local clutter such as `.repos/` never gets in.

**Merged is not released, and released is not installed.** After a merge, check each step and note it in the pull request:

1. **CI is green on `main`**, including the `install` job (a real `npx skills add` on Linux and Windows).
2. **The Release run succeeded**, and the new tag and `seecode.zip` appear under [Releases](https://github.com/Aryanutkarsh/seecode/releases).
3. **An install picks it up:** `npx skills update seecode -g` (or a plugin update), then `node <installed skill>/scripts/seecode.mjs doctor` shows the new `version`.
4. **README media still match:** if the change is visible, refresh the screenshots and GIFs (see [Screenshots and samples](#screenshots-and-samples)).

## Dependencies and licenses

SeeCode has no runtime dependencies, and should stay that way. If a change needs third-party code, vendor it into `skills/seecode/scripts/vendor/`, add its license text to `vendor/LICENSES.md`, and list it in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Contributions are accepted under the project's [MIT license](LICENSE).

## Commit messages

Use short, imperative subjects that say what changed, such as `journey: keep notes off the curve` or `export: size GIFs from content`.
