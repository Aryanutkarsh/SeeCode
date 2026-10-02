# pyramid

A ranked hierarchy (narrow top) or, with `"variant":"funnel"`, conversion drop-off (wide top).

**Fields**
- `levels`: `[{label, value?, sub?, focal?}]`, listed top to bottom.
- `unit`.
- For a funnel with numeric `value`s, the widths scale with the values and each step shows its "% of previous".

**Rules**
- Use 3–7 levels.
- In a funnel, mark the step with the biggest problematic drop as `focal`.
- In a pyramid, the top level is the rarest or most valuable.

**Example**
```json
{"type":"pyramid","variant":"funnel","title":"Trial funnel","levels":[
 {"label":"Visit","value":10000},{"label":"Trial","value":900,"focal":true},{"label":"Paid","value":160}]}
```

**Motion:** `reveal`, wiping each level downward from the top.
