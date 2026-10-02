# polar

Values arranged around a circle as radial lollipops. Use it for cyclical categories (hours, months, compass bearings) or for a compact overview of many categories.

**Fields**
- `data`: `[["label", value], …]`, or `{label,value,focal?}`, with 3–24 items.
- `focal`: a label or labels to accent.
- `center`: short text placed in the middle.
- `max`, `unit`.

**Rules:** Order the items meaningfully: cyclically, or sorted. If the order means nothing, `bar` is clearer.

**Example**
```json
{"type":"polar","title":"Deploys by hour","center":"UTC",
 "data":[["00",2],["04",1],["08",9],["12",14],["16",11],["20",4]],"focal":"12"}
```

**Motion:** `trace`. Stems draw outward around the circle.
