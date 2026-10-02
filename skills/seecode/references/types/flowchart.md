# flowchart

Decision logic with branches.
- Use `sequence` instead when the actors matter more than the logic.
- Use `state` when the system rests in states.

**Fields:** the same as `architecture`, plus `shape`:
- `terminal`: start / end, pill-shaped.
- `decision`: a diamond. Keep its label as a short question.
- `io`: input / output.
- `box`: the default.

The default direction is `"TB"`.

**Placement**
- The main path runs straight down a single `col`. Branches step one `col` left or right.
- Loops back to an earlier step are routed around the outside automatically.
- Give each decision's outgoing edges labels such as `"yes"` / `"no"`.

**Example**
```json
{"type":"flowchart","title":"Deploy gate","nodes":[
 {"id":"s","label":"PR merged","shape":"terminal","row":0,"col":1},
 {"id":"t","label":"Tests green?","shape":"decision","row":1,"col":1},
 {"id":"fix","label":"Fix build","kind":"muted","row":1,"col":0},
 {"id":"d","label":"Deploy","focal":true,"row":2,"col":1}],
 "edges":[["s","t"],["t","fix","no"],["t","d","yes","primary"]]}
```

**Motion:** `trace` draws the path step by step, and the token follows the `primary` edges.
