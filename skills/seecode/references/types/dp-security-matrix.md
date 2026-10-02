# dp-security-matrix

Who can access which data: roles (rows) × data domains (columns).

**Fields**
- `rows`: role names.
- `cols`: domain names.
- `cells`: one row of levels per role, in the same order as `cols`.
- Levels: `none`, `read`, `masked` (aggregated or redacted), `write`, `admin`.
- `focal`: the row name the decision is about.

**Rules:** At most 12 roles and 10 domains. The legend only lists the levels you actually use.

**Example**
```json
{"type":"dp-security-matrix","title":"Access","rows":["Analyst","Support"],"cols":["Orders","PII"],
 "cells":[["read","masked"],["read","none"]],"focal":"Support"}
```

**Motion:** `reveal`, row by row. Hovering a cell shows `role · domain: level`.
