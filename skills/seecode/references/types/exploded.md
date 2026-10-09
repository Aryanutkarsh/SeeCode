# exploded

The parts of one thing, drawn isometric and lifted apart on one vertical axis, each labelled in a column on the right: a phone teardown, an unboxing, a keyboard, or a stack whose layers are physical parts. If nothing has a footprint or thickness, use `layers`.

**Fields:** `parts`, listed bottom to top: a label string, or `{label, sub?, w?, d?, t?, r?, x?, y?, level?, focal?, kind?, items?, side?, hollow?, rings?}`. Units are px-like. Defaults: `w` 240, `d` 160, `t` 14, `r` 10 (`"round"` for a cylinder). `x`/`y` move a part in plan from the centre. Dress parts with `items`/`side`, or a `kind` preset: see `references/isometric.md`.

**Rules:**
- Use 2–6 parts. Parts side by side (a board next to a battery) share a `level` and lift together.
- One `focal` part at most. Give each part 1–2 levels of detail (a screen, chips, keys) so it reads as the real thing.
- Gaps are even and opened until no part hides another; labels never overlap. `W_EXPLODED_LABELS`: two parts on one level end too close, so move one in plan.

**Example**
```json
{"type":"exploded","title":"Inside a phone","parts":[
 {"label":"Housing","kind":"housing","w":150,"d":300,"t":16,"r":26},
 {"label":"Battery","kind":"battery","w":118,"d":140,"t":8,"y":50},
 {"label":"Logic board","kind":"board","w":118,"d":110,"t":4,"y":-80,"focal":true},
 {"label":"Display","kind":"display","w":150,"d":300,"t":8,"r":26}]}
```

**Motion:** `reveal` opens on the assembled object and lifts the parts apart, top first.
