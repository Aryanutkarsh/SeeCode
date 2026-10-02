# line

A change over an ordered x axis (usually time).

**Fields**
- `x`: labels.
- `series`: `[{name, values:[…|null], focal?}]`, at most 5. Use `null` for a gap.
- `unit`, `smooth`, `area`.
- `zero: false` lets the y axis start near the data instead of at zero.

**Variants** (`"variant"`, or use the variant name as `type`)
- `slope` / `slopegraph`: exactly 2 x values. Shows each series' before → after with both values.
- `bump`: values are ranks (1 = top). Shows rank changes over time.
- `stream` / `streamgraph`: stacked, centred areas. Shows composition shifting over time.
- `ridgeline`: one small area per series, stacked. Compares the shapes of distributions.

**Rules:** Accent one `focal` series, which mutes the rest. Labels sit at the line ends, so there's no legend box.

**Example**
```json
{"type":"line","title":"Signups","unit":"k","x":["Jan","Feb","Mar"],
 "series":[{"name":"Organic","values":[3,4,6],"focal":true},{"name":"Paid","values":[5,5,4]}]}
```

**Motion:** `trace`. Lines draw in series order.
