# swimlane

A cross-functional process: who does which step, and where the hand-offs happen. The spec shape is the same as `architecture`/`flowchart`, plus `lanes`.

**Fields**
- `lanes`: `[{id,label}]`, top to bottom (plain strings also work).
- Nodes take `lane` (in place of `row`) and `col`, the step order in time.
- Shapes: `decision`, `terminal` and `box`.

**Rules**
- Give each step its own `col`, increasing with time, so hand-offs read left to right.
- Use at most 5 lanes and 12 steps.

**Example**
```json
{"type":"swimlane","title":"Refund","lanes":[{"id":"c","label":"Customer"},{"id":"s","label":"Support"}],
 "nodes":[{"id":"ask","label":"Request","lane":"c","col":0},{"id":"ok","label":"Approve","focal":true,"lane":"s","col":1},
 {"id":"done","label":"Refunded","lane":"c","col":2}],
 "edges":[["ask","ok"],["ok","done","","primary"]]}
```
