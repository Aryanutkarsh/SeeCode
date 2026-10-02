# Third-party licenses

SeeCode itself is MIT-licensed (see [LICENSE](LICENSE)). It bundles or loads the following third-party software and fonts under their own licenses.

## Bundled code

These encoders ship inside the skill, in [`skills/seecode/scripts/vendor/`](skills/seecode/scripts/vendor/), and are used by the command-line GIF, MP4 and WebM export. Their full license texts are in [`vendor/LICENSES.md`](skills/seecode/scripts/vendor/LICENSES.md), which ships with the skill.

| Package | Version | License | Copyright | Upstream |
|---|---|---|---|---|
| gifenc | 1.0.3 | MIT | © 2017 Matt DesLauriers | https://github.com/mattdesl/gifenc |
| mp4-muxer | 5.2.2 | MIT | © 2023 Vanilagy | https://github.com/Vanilagy/mp4-muxer |
| webm-muxer | 5.1.4 | MIT | © 2022 Vanilagy | https://github.com/Vanilagy/webm-muxer |

## Loaded at runtime

A diagram's own Export menu loads the same three packages, at the same versions, from jsDelivr (`cdn.jsdelivr.net`) when you export a GIF or MP4. They aren't included in the HTML file.

## Fonts

Diagrams use these fonts, loaded from Google Fonts. No font files ship with SeeCode. SVG export embeds a subset of each font (only the characters the diagram uses) into the SVG, which the SIL Open Font License permits.

| Font | License | Upstream |
|---|---|---|
| Fraunces | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces |
| IBM Plex Sans, IBM Plex Mono | SIL Open Font License 1.1 | https://github.com/IBM/plex |

The license is published at https://openfontlicense.org.

A brand profile can add fonts of your own, loaded from Google Fonts or your site. Those stay under their own licenses, and are embedded into SVG exports only as the diagram's text needs them.

## Development only

Nothing else is bundled. The tests and tools use only Node's standard library, and export drives the Chrome, Edge or Chromium already installed on your machine. If no system browser is found, export can use [Playwright](https://github.com/microsoft/playwright) (Apache-2.0), but only if you've installed it yourself.

## Trademarks

Product and format names used in docs and examples (such as Mermaid, draw.io, Excalidraw, PlantUML, Graphviz, D2, Postgres, Kafka and Stripe) belong to their owners. Their use is descriptive and implies no endorsement or affiliation.
