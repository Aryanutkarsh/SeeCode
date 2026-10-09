# heatmap

Intensity across two categorical axes, such as hour × day or service × region.

**Fields**
- `rows`, `cols`: labels.
- `values`: a `rows × cols` grid of numbers (`null` leaves a cell empty).
- `unit`, `min`, `max`.
- `scale`: `"sequential"` (the default) or `"diverging"`. Diverging is used automatically when the data spans both sides of 0.
- `labels: false` hides the values printed in cells.

**Rules:** At most about 20 × 20 cells. Sort the rows meaningfully: by total, or in their natural order.

**Example**
```json
{"type":"heatmap","title":"Errors by region","rows":["eu","us"],"cols":["Mon","Tue","Wed"],"values":[[3,9,2],[1,4,12]]}
```

**Motion:** `reveal`, row by row. Hovering a cell shows its value.

**Values in cells:** shown when cells are wide enough (about 13 columns or fewer), in black or white, whichever reads better on that cell in each theme. With more columns you get `W_HEATMAP_LABELS` and values on hover only.
