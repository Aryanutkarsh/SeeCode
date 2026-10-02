# sankey

Flow volumes splitting and merging across stages (budgets, traffic, time, conversions).

**Fields**
- `links`: `[["from","to",value,focal?],…]`, or a CSV path (columns `from`,`to`,`value`, or set the `from`/`to`/`value` names).
- `nodes[]` (optional): `{id,label?,focal?,col?}`, to rename nodes, accent them or pin their column.
- `unit`.

**Rules**
- A node's in-flow should equal its out-flow. Mismatches render, but they look wrong.
- At most 18 nodes. Merge small flows into `"Other"`.

**Example**
```json
{"type":"sankey","title":"Signup funnel","links":[["Visit","Signup",420],["Visit","Bounce",1580],["Signup","Active",260,true],["Signup","Churned",160]]}
```

**Motion:** `reveal`. Columns appear left to right and ribbons wipe in after their source.
