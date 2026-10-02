# radar

Several items compared on 3–10 shared dimensions (a profile).

**Fields**
- `axes`: dimension names.
- `series`: `[{name, values, focal?}]`, at most 3, with one value per axis.
- `max`: the scale maximum (for example 5 or 100).
- `unit`.

**Rules**
- All axes must use the same scale and direction, so that higher is better everywhere.
- Use a `focal` series so the others mute.
- With more than 3 series or more than 10 axes, use `bar` or `heatmap` instead.

**Example**
```json
{"type":"radar","title":"Vendor fit","axes":["Price","Speed","Support","Security"],"max":5,
 "series":[{"name":"Acme","values":[4,3,5,4],"focal":true},{"name":"Globex","values":[3,5,2,3]}]}
```

**Motion:** `reveal`. Each polygon pops in after the axes.
