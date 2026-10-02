# medallion

Data platform layers, for example sources → bronze → silver → gold → consumers.

**Fields**
- `stages`: `[{label, items:[…], plain?, kind?, style?}]`, listed left to right.
- `items` are strings, or `{id,label,sub,focal}`. Auto ids are `stage<i>_<j>`.
- `plain: true` turns off the stage box; use it for sources and consumers.
- `edges` is optional. If you leave it out, item `j` connects to item `j` (or the last item) of the next stage.

**Rules**
- Use at most 4 items per stage, naming tables or datasets rather than jobs.
- Make one gold item `focal`: the product the platform exists for.

**Example**
```json
{"type":"medallion","title":"Lakehouse","stages":[
 {"label":"Sources","plain":true,"kind":"input","items":["CDC","Events"]},
 {"label":"Bronze","items":["raw_orders","raw_events"]},
 {"label":"Silver","items":["orders","sessions"]},
 {"label":"Gold","items":[{"label":"revenue","focal":true}]}]}
```
