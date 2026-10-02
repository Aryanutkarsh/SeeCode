# wardley

A Wardley map: components placed by how visible they are to the user (y) and how evolved they are (x, from genesis to commodity).

**Fields**
- `components`: `[{id, label, evo:0..1, vis:0..1, anchor?, focal?, inertia?, moveTo?}]`.
  - `anchor: true` marks the user need, at the top (`vis` 1).
  - `moveTo`: the evolution value it is moving toward, drawn as a dashed arrow.
  - `inertia: true` draws a bar showing resistance to change.
- `links`: `[["from","to"]]`, as value-chain dependencies.

**Rules:** At most 20 components. Use `focal` for the component the strategy is about.

**Example**
```json
{"type":"wardley","title":"Payments","components":[{"id":"u","label":"Merchant","evo":0.6,"vis":1,"anchor":true},
 {"id":"api","label":"Payments API","evo":0.5,"vis":0.7,"focal":true},{"id":"k","label":"Card network","evo":0.9,"vis":0.2}],
 "links":[["u","api"],["api","k"]]}
```

**Motion:** `trace`. Components appear from the top down, then the links draw.
