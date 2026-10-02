# scatter

The relationship between two measures, one point per item.

**Fields**
- `points`: `[["label",x,y,size?], …]`, or `{label,x,y,size?,group?,focal?}`.
- `xLabel`, `yLabel`, `unitX`, `unitY`.
- `zero: false` crops the axes to the data.

**Variants**
- `bubble`: a third value (`size`) is drawn as area.
- `beeswarm`: one value (`x`) per point, packed without overlap and grouped by `group`. Shows distributions.

**Rules**
- Points are labelled only when there are 12 or fewer, plus any point marked focal.
- Mark the 1–3 points the story is about as `focal`.
- Over 200 points, aggregate the data first.

**Example**
```json
{"type":"scatter","title":"Cost vs speed","xLabel":"cost ($)","yLabel":"P95 MS",
 "points":[["A",120,340],["B",80,410],{"label":"Ours","x":60,"y":210,"focal":true}]}
```

**Motion:** `reveal`. Points pop in, largest first.
