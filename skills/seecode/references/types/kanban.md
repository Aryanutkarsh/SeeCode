# kanban

Work items by status.

**Fields**
- `columns`: `[{label, wip?, cards:["text" | {label, tag?, sub?, focal?, kind?}]}]`, listed left to right.
- `wip`: the column's work-in-progress limit. When a column holds more cards than its limit, the column is flagged.

**Rules:** Use at most 6 cards per column, adding `"+4 more"` as the last card if needed. `tag` holds a priority or label (`P1`); `sub` holds an owner or estimate.

**Example**
```json
{"type":"kanban","title":"Sprint 14","columns":[
 {"label":"To do","cards":["Login page","Rate limits"]},
 {"label":"Doing","wip":2,"cards":[{"label":"Billing v2","focal":true,"tag":"P0"}]},
 {"label":"Done","cards":["Search"]}]}
```

**Motion:** `reveal`. Columns appear first, then the cards top-down.
