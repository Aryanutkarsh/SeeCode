# isometric

Any object in isometric 3D from a plain description ("an office chair", "a laptop", "a delivery van"). You list its parts; SeeCode places, shades, sorts and labels them. For stacked layers use `exploded`; for a floor or site, `isometric-plan`.

**Fields:** `parts`, each either
- a **solid**: `{label?, sub?, x, y, z, w, d, h, r?, axis?, tone?, top?, items?, side?, hollow?, focal?}`. `x, y` are its centre, `z` its base, `z` up. `r:"round"` is a cylinder; `axis:"x"|"y"` lays a round part on its side (wheels, pipes), with `h` as its diameter. `tone: "dark"` for metal, rubber or plastic parts.
- a **beam**: `{label?, from:[x,y,z], to:[x,y,z], thick?, tone?}` for legs, poles, arms, handles, cables.

Units are free: the object is scaled to a readable size. Parts with a `label` get a callout in a column on the right.

**Rules:**
- Read `references/isometric.md` (how to model an object, plus the item grammar) before writing.
- 5–25 parts; label 3–7, one `focal`.
- Put the detailed face toward the viewer: the front-left wall (`side` face `left`, the +y side) or the front-right (`right`, +x).

**Example**
```json
{"type":"isometric","title":"Stool","parts":[
 {"label":"Seat","x":0,"y":0,"z":60,"w":50,"d":50,"h":6,"r":"round","focal":true},
 {"from":[-15,-15,0],"to":[-12,-12,60],"thick":4},{"from":[15,-15,0],"to":[12,-12,60],"thick":4},
 {"from":[-15,15,0],"to":[-12,12,60],"thick":4},{"label":"Legs","from":[15,15,0],"to":[12,12,60],"thick":4}]}
```

**Motion:** `reveal`, built from the ground up.
