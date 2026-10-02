# org-chart

A hierarchy: parent → children. `org-chart` is the same spec, used for people and teams (`sub` holds the role).

**Fields**
- `dir`: `"TB"` (default) | `"LR"`. Use `LR` for deep, narrow trees or long labels.
- `root`: `{label,sub?,tag?,kind?,focal?,id?,children:[…]}`, nested.

**Budget**
- At most 24 nodes and at most 6 children per parent.
- Collapse long tails into a single `"+12 more"` leaf (kind `muted`).

**Example**
```json
{"type":"tree","title":"Docs site","root":{"label":"docs/","children":[
 {"label":"guides/","children":[{"label":"quickstart"},{"label":"deploy","focal":true}]},
 {"label":"reference/","children":[{"label":"API"},{"label":"CLI"}]}]}}
```

**Motion:** `reveal`, level by level from the root, with connectors drawing in before each level.
