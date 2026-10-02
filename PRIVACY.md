# Privacy Policy

Effective 2026-10-02.

This policy covers the SeeCode skill and plugin in every host it runs in, including Claude Code, Claude.ai, Codex, Copilot and other Agent Skills hosts, and the diagram files it produces.

SeeCode is a set of instructions and local Node scripts that run inside the agent you install it in. It has no server, no accounts, no analytics, no telemetry and no update checks. The SeeCode maintainers receive no data from your use of it.

## What SeeCode works with

SeeCode uses only what you give your agent: a description of the diagram you want, specs, files you ask it to import, repositories you ask it to scan, data files for charts, and (if you ask for brand onboarding) a website address or brand colours. That content stays in your agent session and wherever your agent runs: on your computer for local agents, or in your provider's workspace for hosted ones.

SeeCode doesn't ask for and doesn't need passwords, payment details, government identifiers, health data or other sensitive data.

## How it's used

Only to make the diagram you asked for: to choose a type, lay it out, style it, animate it and write HTML, SVG, PNG, GIF or MP4 files. It isn't used for advertising, profiling or training, and isn't combined with other data.

## Network requests

SeeCode itself makes only these requests:

| Request | When | What is sent |
|---|---|---|
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | When a browser opens a generated HTML diagram, and during PNG/GIF/MP4 export | The font request. Google receives the viewer's IP address and browser details under [Google's privacy policy](https://policies.google.com/privacy). Diagram content isn't sent. |
| **Google Fonts, font subsets** | During SVG export, from the CLI or the Export menu, to embed fonts in the SVG | The set of distinct characters that appear in the diagram (in the `text=` parameter, unordered and de-duplicated), so Google can return just those glyphs. The labels themselves aren't sent. |
| **A website you name for brand onboarding** | Only when you (or your agent, at your request) run `brand <url>` | Ordinary requests for that page and up to six of its stylesheets, like a browser visit. Only colours and font names (with their font-file addresses) are kept. |
| **Google Fonts, brand font check** | During `brand`, for each font the brand uses | The font's family name, to see whether Google Fonts serves it |
| **The brand's own font files** | When a diagram that uses a self-hosted brand font opens, or is exported to SVG | A normal request for that font file from the brand's site |
| **jsDelivr** (`cdn.jsdelivr.net`) | Only when you export GIF or MP4 from a diagram's own Export menu | A request for the open-source encoder modules. jsDelivr receives the viewer's IP address and browser details under [its terms and privacy policy](https://www.jsdelivr.com/terms). No diagram content is sent. |

Encoding itself happens on your device. The CLI's export uses encoders bundled with the skill and makes no request to jsDelivr.

Your agent may also fetch things on your behalf with its own tools, only when you ask.

## Who receives data

- **Your AI agent's provider** processes your prompts and files under its own privacy policy. SeeCode doesn't change how your agent handles data.
- **Google Fonts** and **jsDelivr**, as described above.
- **The SeeCode maintainers** receive nothing. There is no server to send data to.

## Where things are stored

Diagrams, specs and exports are written where you or your agent choose. Settings are stored in `~/.seecode/config.json` and `<project>/.seecode/config.json`, and brand profiles (colours plus the source they were learned from) in `~/.seecode/profiles/`. These stay wherever your agent runs until you delete them.

## Your controls

- Delete generated files, settings and profiles at any time; they are ordinary files.
- Open a diagram offline and it falls back to system fonts. Export SVG without network access and the fonts aren't embedded; the SVG still works.
- Export GIF and MP4 from the command line instead of the Export menu to avoid the jsDelivr request.
- Uninstall the skill or plugin from your agent at any time.

## Changes and contact

Changes to this policy are published here with a new effective date, and the full history is in this repository's git log. Ask questions in [GitHub issues](https://github.com/Aryanutkarsh/seecode/issues). Report security problems privately, as described in [SECURITY.md](SECURITY.md).
