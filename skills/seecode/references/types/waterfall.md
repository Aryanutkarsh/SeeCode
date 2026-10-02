# waterfall

A running total, showing how a start value becomes an end value through gains and losses.

**Fields**
- `steps`: `[["label", ±value], …]`, or `{label, value, total?, focal?}`.
  - The first positive step is the starting total.
  - `{label, total:true}` inserts a subtotal.
  - An end total is added automatically; `"end":false` turns it off, and `endLabel` renames it.
- `unit`.

**Rules:** At most 12 steps. Gains show green-ish and losses clay. Mark the step the story is about as `focal`.

**Example**
```json
{"type":"waterfall","title":"Q3 margin","unit":"$","steps":[["Revenue",120],["COGS",-48],{"label":"Infra","value":-22,"focal":true},["Price rise",9]]}
```

**Motion:** `reveal`. Bars grow in order and connectors appear between them.
