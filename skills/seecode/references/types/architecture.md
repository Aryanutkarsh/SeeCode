# architecture

Components and how they talk. Same spec shape as `high-level` (overview, fewer details) and `deployment` (where things run; use groups for hosts/regions).

**Fields**
- `dir`: `"LR"` (default) | `"TB"`.
- `nodes[]`: `id`, `label`, `sub?`, `tag?` (≤ 8 chars, e.g. `API`), `kind?`, `focal?`, `row`, `col`, `group?`.
- `kind`: `backend` (default), `store` (DB/cache/queue), `external`, `input`, `optional`, `security`, `muted`.
- `edges[]`: `["from","to","label?","kind?"]`, or `{from,to,label,kind,both}`.
- Edge `kind`: `default`, `primary` (main path), `link` (HTTP), `async`/`return` (dashed), `muted`.
- `groups[]`: `{id,label,style?:"dashed"}`. Assign nodes with `node.group`.

**Placement**
- Flow left → right by `col`. Parallel peers share a `col` and take different `row`s.
- Stores sit beside the service that owns them. External actors go at the edges (col 0 or last).
- Members of a group should be contiguous in rows and cols.

**Example**
```json
{"type":"architecture","title":"Checkout","nodes":[
 {"id":"web","label":"Storefront","kind":"external","row":0,"col":0},
 {"id":"api","label":"Checkout API","sub":"Go","focal":true,"row":0,"col":1},
 {"id":"db","label":"Orders DB","sub":"Postgres","kind":"store","row":1,"col":1}],
 "edges":[["web","api","HTTPS","primary"],["api","db","write"]]}
```

**Motion**
- `trace`: edges draw in from the sources outward, and one token runs along the `primary` path, or towards the focal node.
- Use `"order":[ids]` to script a different sequence.
