# treemap

Part-of-whole by area, optionally with one level of nesting.

**Fields**
- `data`: `[["label", value], …]`, or `{label, value?, focal?, children:[["sub", v], …]}`.
- `focal`: a label or labels to accent.
- `unit`.

**Rules**
- At most 24 cells. Fold the long tail into `"Other"`.
- Cells too small to label are flagged with an `I_` note.
- For exact comparison between items, use `bar`; treemaps show proportion.

**Example**
```json
{"type":"treemap","title":"Cloud spend","unit":"$","focal":"Compute",
 "data":[["Compute",52000],["Storage",18000],["Network",9000],["Other",4000]]}
```

**Motion:** `reveal`. Cells fade in from largest to smallest.
