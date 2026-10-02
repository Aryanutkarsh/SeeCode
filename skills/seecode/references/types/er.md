# er

Entities and how they relate (a conceptual or logical model). Use `db-schema` instead for physical tables with types.

**Nodes:** `{id,label,fields:["id PK","email UQ","name"],row,col,focal?}`. A field written as `"name type KEY"` can carry the keys PK, FK, UQ, NN or IDX.

**Edges:** `["a","b","verb?","cardinality"]`.
- Cardinality is one of `one-one`, `one-many`, `many-one`, `many-many`, `zero-many` or `one-zero`, drawn as crow's-foot ends.
- The edge reads from `a` to `b`, so `["customer","order","places","one-many"]` means one customer places many orders.

**Placement:** the central entity goes in the middle column, with its parents to the left and children to the right or below. Keep it to at most 8 fields per entity, showing only the fields that matter.

**Example**
```json
{"type":"er","title":"Shop","nodes":[
 {"id":"c","label":"Customer","fields":["id PK","email UQ"],"row":0,"col":0},
 {"id":"o","label":"Order","focal":true,"fields":["id PK","customer_id FK"],"row":0,"col":1}],
 "edges":[["c","o","places","one-many"]]}
```
