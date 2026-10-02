# state

A state machine: the states a thing rests in, and the events that move it between them. The spec shape is the same as `architecture`, except that `shape` defaults to `state`.

**Nodes**
- `{"id":"s","shape":"start"}` and `{"id":"e","shape":"end"}` are pseudo-states and need no label.
- Mark the happy-path terminal state `focal`.

**Edges:** `["from","to","event [guard]","kind?"]`.
- A self transition (`["a","a","edit"]`) draws as a loop.
- Two-way pairs are fine; their labels sit on the outer side.

**Placement:** the happy path runs along `row 0`, left to right. Error and retry states sit in `row 1`, under the state they branch from.

**Example**
```json
{"type":"state","title":"Order","nodes":[{"id":"s","shape":"start","row":0,"col":0},
 {"id":"p","label":"Pending","row":0,"col":1},{"id":"ok","label":"Paid","focal":true,"row":0,"col":2},
 {"id":"x","label":"Failed","kind":"muted","row":1,"col":1}],
 "edges":[["s","p"],["p","ok","charge ok","primary"],["p","x","declined"],["x","p","retry"]]}
```

**Motion:** `trace` follows the transitions out from the start state.
