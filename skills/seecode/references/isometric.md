# Composing isometric parts and boxes

Both isometric types (`exploded` parts, `isometric-plan` boxes) draw every solid the same way, and you dress it with a small grammar instead of picking from fixed drawings. Compose anything: a phone, a keyboard, a burger, a server rack, a building, a coffee machine.

## The solid

`w`, `d` (footprint), `t` (exploded) or `h` (plan) height, and `r`: corner radius in units, or `"round"` for a cylinder or pill.

- `hollow: true` (or a wall width) makes a tray, case, box or shell: its back paints before what sits inside it, its front after.
- `rings: true` draws ribs around the sides (a bun, a speaker, a coil).
- `top`: a shaped top above the walls, `topH` tall (default about a third of the footprint): `dome` (a bun, a dome, a lens, a pillow), `gable` (a pitched roof, ridge along the long side), `hip` (sloping on all sides, a pyramid on a square), `shed` (one slope, high at the back). Flat items on a shaped top drape onto it (sesame on a bun, vents on a roof). Raised items can have a `top` too.

## `items`: on the top face

Each item is placed in fractions of the face it sits on, x along `u`, y along `v`:
- `box: [u0, v0, u1, v1]`, or `at: [u, v]` with `size: [w, d]`.
- `h` raises it into a solid (a chip, a key, a camera bump, a table). Without `h` it is flat.
- `shape` (flat items): `panel` (default), `hole`, `ring` (outline only), `lines` (rules, vents), `text` (ragged lines, like writing), `dots`.
- `tone`: `light`, `dark` (a screen or chip), `black`, `accent`, `mid`, `cut`. For strokes (rings, lines, text): `light`, `dark` or `accent`.
- `r`: as for the solid, or `"inherit"` to follow the parent's corners.
- `repeat: [cols, rows]` fills the box with a grid of copies, each `fill` (default 0.7) of its cell: keys, pads, solar panels, desks.
- `n` (how many lines), `dir: "v"` (vertical lines), `dash: true`.
- `items` nest: lenses on a camera module on a board.

Flat items paint first, raised ones back to front.

## `side`: on the two visible walls

`face`: `left` (front-left wall), `right` (front-right wall) or `both`. `box: [u0, v0, u1, v1]`: `u` along the wall, `v` from bottom (0) to top (1). Shapes: `panel`, `lines` (windows, shelves, vents; `n`, `dir`, `dash`), `text`, `button` (sticks out slightly). `repeat` works as on the top.

## Presets (`kind`)

Shorthands written in the same grammar. Your own `items` and `side` are added on top of them.

- Exploded parts: `display`, `screen`, `terminal`, `board`, `pcb`, `battery`, `plate`, `keys`, `switches`, `cards`, `chip`, `studs`, `speaker`, `lid`, `vault`, `housing`, `tray`.
- Plan boxes: `furniture` (default), `desk`, `table`, `counter`, `post`, `rack`, `building`, `house` (gabled, with door and windows), `tree`.
- Either: `bun` (a domed cylinder).

## Example: a phone's logic board with a camera module

```json
{"label":"Logic board","kind":"board","w":118,"d":110,"t":4,"r":4,
 "items":[{"box":[0.06,0.06,0.42,0.48],"h":5,"r":7,"tone":"light","items":[
   {"at":[0.3,0.3],"size":[0.38,0.38],"r":"round","h":2.5,"tone":"dark"},
   {"at":[0.72,0.72],"size":[0.38,0.38],"r":"round","h":2.5,"tone":"dark"}]}]}
```

## Tips

- Two or three levels of detail read best: the solid, panels or insets on its top, then small pieces. More turns to noise at this size.
- Use `dark` for screens and chips, `accent` only on the focal part's detail, and `mid`, `cut` or `ring` for subtle detail.
- Units are px-like. A phone is roughly 150×300, a desk 60×30, a building 120×90 with height 40–60.
