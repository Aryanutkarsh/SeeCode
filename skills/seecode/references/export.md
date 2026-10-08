# Export

`SC export <diagram.html> --formats png,jpeg,webp,svg,gif,mp4,webm` (or `--for <destination>`)

The default formats come from `settings.exportFormats`. Outputs are written next to the HTML file, using the same name.

| Flag | Default | Meaning |
|---|---|---|
| `--scale` | `auto` | Pixel ratio. `auto` sizes each format from the content (below); a number is a target, still capped by the format's budget |
| `--fps` | `30` | Video frame rate. GIF fps is chosen by size (15, 12 or 10) |
| `--duration` | `auto` | Length in seconds. `auto` is the full reveal, plus one token loop, plus a short hold |
| `--theme` | `light` | `light` or `dark` |
| `--crop` | `figure` | `figure` (title + diagram) or `diagram` |
| `--gif-width` | auto | Force a GIF width in px |

**Sizing is content-aware.** The diagram is laid out 1:1, then each format gets its own pixel ratio:
- the smallest text should be at least 16 device px (never below 2×); small diagrams get 3× so they stay sharp when shown large;
- each format has a budget: PNG/JPEG/WebP up to 8,000 px wide (40 MP), GIF up to 2,000 px wide (2.4 MP, so files stay small), MP4/WebM up to 3840×2160 with even dimensions;
- large GIFs drop to 12 or 10 fps instead of growing;
- if the content is too big for a format to keep text readable (smallest text under 9 px), the result carries a warning: deliver SVG or PNG instead, or split the diagram.

Each file in the JSON result reports `width`, `height` and `scale`. The HTML's own Export menu uses the same rule (`SeeCode.exportPlan(format)`).

- **Static formats** (png, jpeg, webp, svg) capture the settled end frame. **Animated formats** (gif, mp4, webm) step the page's own CSS animations frame by frame, so the output is identical on every run, and frames are captured at the final size (no resampling).
- **Requirements:** Node ≥ 20 and a Chrome-family browser for raster/animated formats. Nothing to install: the encoders are bundled. System ffmpeg is used only if the browser lacks H.264.
- **Offline or behind a proxy:** if web fonts don't load within 15 s, export finishes with fallback fonts and adds a `W_FONTS` warning instead of hanging. Retry online for the real typography, or set `SEECODE_LOAD_TIMEOUT_MS` to wait longer.
- `SC doctor` reports anything that's missing.

**Where each format comes from**
- **SVG** is built in plain Node, so it works with no browser, including the Claude.ai sandbox.
- **PNG, JPEG, WebP, GIF, MP4 and WebM** from the CLI need a Chrome-family browser.
- **The HTML's own Export menu** produces PNG, JPEG, SVG, GIF and MP4 in the viewer's browser, so there's always a fallback.
