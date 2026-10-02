# data-flow

Data moving through stages: sources → processing → stores → consumers. The spec shape is the same as `architecture`.

**Placement**
- One `col` per stage, left to right. Sources (kind `input`/`external`) go in col 0, and sinks or consumers in the last col.
- Name each edge after the data it carries (`events`, `rows`, `features`), not the protocol.
- Mark the hot path `primary`, and batch or async hops `async`.

**Example**
```json
{"type":"data-flow","title":"Product analytics","nodes":[
 {"id":"app","label":"App events","kind":"input","row":0,"col":0},
 {"id":"q","label":"Ingest queue","kind":"store","row":0,"col":1},
 {"id":"etl","label":"Sessionize","focal":true,"row":0,"col":2},
 {"id":"wh","label":"Warehouse","kind":"store","row":0,"col":3},
 {"id":"bi","label":"Dashboards","kind":"external","row":1,"col":3}],
 "edges":[["app","q","events","primary"],["q","etl","batches","primary"],["etl","wh","sessions","primary"],["wh","bi","queries","async"]]}
```

**Motion:** `trace`, with a token that follows the data from source to sink.
