# nested

A hierarchy shown as containment: scopes, network boundaries, an org or a codebase. Use `tree` instead when the relationships matter more than the scope.

**Fields**
- `root`: `{label, sub?, focal?, cols?, children:[…]}`, recursive. A leaf can be a plain string.
- `cols`: the grid width for a container's children. By default up to 4 children sit in a row; more than that wrap into a square-ish grid.

**Rules:** At most 4 levels and 24 boxes in total. Leaves are the concrete things; containers carry boundary names (`VPC`, `Team`, `Package`).

**Example**
```json
{"type":"nested","title":"Runtime","root":{"label":"Cluster","children":[
 {"label":"Namespace: web","children":["frontend",{"label":"api","focal":true}]},
 {"label":"Namespace: data","children":["postgres","redis"]}]}}
```

**Motion:** `reveal`, from the outer boxes inward.
