# bar

Compare amounts across categories.

**Fields**
- `data`: `[["label",value],…]`, or a CSV/JSON path (`"data":"sales.csv"`, with `x`/`y` to pick the columns).
- Or `categories` + `series[]` (`{name,values,focal?}`), for at most 5 series.
- `focal`: the label(s) that carry the point. Those bars are the only ones accented.
- `orientation`: `"vertical"` (default) | `"horizontal"`. Use horizontal for long labels or more than 8 bars.
- `unit`: `"%"`, `"$"`, `"ms"`, `"k"`, etc.
- `axis`: the axis caption.
- `sort`: `"desc"` | `"asc"`.

**Variants**
- `dumbbell`: two values per category, before → after. Use `data:[["label",a,b]]`, `from`, `to`.
- `marimekko`: column width is the column's total, and each column is split by share. Use `columns:[{label, segments:[["name",v]]}]`.

**Budget:** at most 16 bars. Fold the tail into `"Other"`.

**Example**
```json
{"type":"bar","title":"p95 latency by region","unit":"ms","focal":"eu-west","sort":"desc",
 "data":[["us-east",182],["eu-west",344],["ap-south",210]]}
```

**Motion:** `reveal`. Bars grow from the baseline left to right, then their values fade in.
