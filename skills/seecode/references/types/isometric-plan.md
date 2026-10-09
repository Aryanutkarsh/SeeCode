# isometric-plan

A floor or site seen from above at an angle: an office, a campus, a warehouse, a shop.

**Fields:** coordinates are px-like on the plate, with `x` to the right-front and `y` to the left-front.
- `rooms`: `[{label, sub?, x, y, w, d, walls?, door?:"N"|"S"|"E"|"W"|[…], focal?, step?}]`. A tinted floor and a tag; `walls` adds low walls with a door gap. Touching rooms share one wall.
- `boxes`: `[{x, y, w, d, h?, kind?, label?, sub?, focal?, step?, items?, side?, r?}]`. Kinds: `furniture`, `desk`, `table`, `counter`, `post`, `rack`, `building`, `tree`. Dress any box with `items`/`side` (`references/isometric.md`). Named boxes get a tag on top.
- `marks`: `[{x, y, w, d, kind?:"road"}]` flat roads (dashed centre line), paths or zones. `plate`: `{w, d}` (default: fits everything).

**Rules:**
- Footprints never overlap (`W_PLAN_OVERLAP`); everything stays on the plate (`W_PLAN_BOUNDS`).
- Name only rooms and buildings the reader needs; leave furniture unnamed. One focal room or building.
- `step` phases (1–12) reveal a site in build order.

**Example**
```json
{"type":"isometric-plan","title":"Office","rooms":[
 {"label":"Open office","x":0,"y":0,"w":260,"d":180,"walls":true,"door":"S"},
 {"label":"Meeting","x":260,"y":0,"w":120,"d":100,"walls":true,"door":"S","focal":true}],
 "boxes":[{"x":30,"y":30,"w":60,"d":30},{"x":290,"y":30,"w":60,"d":40,"h":10}]}
```

**Motion:** `reveal`; boxes with a `step` drop into place phase by phase.
