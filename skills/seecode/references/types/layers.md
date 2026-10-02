# layers

A layer stack, such as a tech stack, an OSI-style model or abstraction levels. The top layer is the one closest to the user.

**Fields:** `layers`: `[{label, sub?, items?:["chip",…], focal?, kind?}]`, listed top to bottom. `items` holds the components in that layer, at most 6 chips.

**Rules:**
- Use 3–7 layers, each a noun ("Data", "Services").
- Use `sub` for one line on what the layer does.
- Mark the layer the story is about as `focal`.

**Example**
```json
{"type":"layers","title":"Our stack","layers":[
 {"label":"Experience","items":["web","iOS"]},
 {"label":"Services","items":["auth","billing"],"focal":true},
 {"label":"Data","items":["Postgres","S3"]}]}
```

**Motion:** `reveal`, from the bottom up, foundation first.
