# architecture-delta

The before and after of a system change, shown in one picture. The spec shape is the same as `architecture`, plus `change` on nodes and edges.

**Fields**
- `change`: `added` (accent outline, `+ NEW`), `removed` (faded, struck through, dashed) or `changed` (dashed accent outline, pulses once).
- Edges use the object form when they change: `{"from":"a","to":"b","change":"removed"}`.

**Rules**
- Show only the neighbourhood of the change, plus one hop of context.
- Use `focal` for the new component that carries the change.
- Mark the new request path `primary`.

**Example**
```json
{"type":"architecture-delta","title":"Search moves out","nodes":[
 {"id":"web","label":"Web","row":0,"col":0},{"id":"mono","label":"Monolith","change":"changed","row":0,"col":1},
 {"id":"svc","label":"Search service","change":"added","focal":true,"row":1,"col":1}],
 "edges":[["web","mono"],["web","svc","/search","primary"]]}
```

**Motion:** `trace`. Changed nodes pulse after everything settles.
