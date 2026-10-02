# uml-class

Classes and interfaces, with their relations.

**Nodes:** `{id,label,tag?:"«interface»",attrs:["- name: type"],methods:["+ call(): T"],row,col}`. An empty `attrs` still draws its compartment.

**Edge kinds**
- `extends` and `implements`: hollow triangle (implements is dashed).
- `composes`: filled diamond at the owner, which is the `from` end.
- `aggregates`: hollow diamond.
- `depends`: dashed open arrow.
- `assoc`: plain line.

**Placement:** use `"dir":"TB"`. Parents and interfaces go on `row 0`, implementations below them.

**Example**
```json
{"type":"uml-class","dir":"TB","title":"Providers","nodes":[
 {"id":"p","label":"Provider","tag":"«interface»","methods":["charge()"],"row":0,"col":1},
 {"id":"s","label":"Stripe","methods":["charge()"],"row":1,"col":0},
 {"id":"a","label":"Adyen","methods":["charge()"],"row":1,"col":2}],
 "edges":[["s","p","","implements"],["a","p","","implements"]]}
```
