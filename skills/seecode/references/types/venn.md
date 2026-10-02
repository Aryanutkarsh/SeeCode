# venn

The overlap between 2 or 3 sets. Its point is usually the centre.

**Fields**
- `sets`: 2–3 items, `{id,label,sub?,focal?}` (or plain strings, which get auto ids `s0`, `s1`, …).
- `overlaps`: `[{sets:["a","b"],label,focal?}]`. Use a 3-id entry for the centre.

**Rules**
- Overlap labels are 1–2 words and say what the overlap *is* ("specs"), not "A ∩ B".
- Make the centre `focal` when it's the answer.

**Example**
```json
{"type":"venn","title":"Sweet spot","sets":[{"id":"a","label":"Skill"},{"id":"b","label":"Demand"}],
 "overlaps":[{"sets":["a","b"],"label":"career","focal":true}]}
```

**Motion:** `reveal`. Sets pop in one after another, then the overlap labels appear.
