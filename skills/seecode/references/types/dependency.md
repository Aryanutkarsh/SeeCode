# dependency

What depends on what: modules, packages, services. Edges point from the dependent **to** its dependency. The spec shape is the same as `architecture`.

**Placement**
- With `"dir":"TB"`, entry points go on row 0 and shared foundations on the bottom row.
- Leaving out `row`/`col` gives you a draft auto-layered grid (an `I_AUTOPLACED` note). Adjust it afterwards.
- Show cycles explicitly, by marking the back edge `primary` so it stands out.

**From code:** run `SC scan` and use its `modules[].uses` as edges. Keep at most 12 modules; fold leaf utilities into a single `shared` node.

**Example**
```json
{"type":"dependency","dir":"TB","title":"Package graph","nodes":[
 {"id":"cli","label":"cli","row":0,"col":0},{"id":"web","label":"web","row":0,"col":1},
 {"id":"core","label":"core","focal":true,"row":1,"col":0},{"id":"util","label":"shared","kind":"muted","row":2,"col":0}],
 "edges":[["cli","core"],["web","core"],["core","util"],["web","util"]]}
```
