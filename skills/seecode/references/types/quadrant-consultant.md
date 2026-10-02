# quadrant-consultant

A 2×2 that positions items on two axes. With `"variant":"consultant"`, each quadrant holds a titled list instead of plotted points (the `quadrant-consultant` type).

**Fields**
- `x`, `y`: `{label, low, high}`.
- `quadrants`: 4 labels in the order top-left, top-right, bottom-left, bottom-right. They can be strings or `{label, focal?, items?}`.
- `items`: `[{label, x:0..1, y:0..1, focal?}]`, the plotted points, at most 12.

**Rules:** Name each quadrant with a verdict ("Quick wins", "Avoid"). Mark only the item the decision is about as `focal`.

**Example**
```json
{"type":"quadrant","title":"Prioritise","x":{"label":"Effort","low":"low","high":"high"},"y":{"label":"Impact","low":"low","high":"high"},
 "quadrants":["Quick wins","Big bets","Fill-ins","Avoid"],"items":[{"label":"SSO","x":0.2,"y":0.8,"focal":true}]}
```

**Motion:** `reveal`. The frame appears, then the quadrants, then the points pop in.
