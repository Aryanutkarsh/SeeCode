# it-state

The current IT landscape: which systems exist, how they're connected, and how healthy each one is. The spec shape is the same as `architecture`, plus `status`.

**Fields**
- `status`: `ok`, `risk`, `legacy` or `retire`. Each status gets a coloured dot and a legend entry.
- `groups`: domains, or the system of record.
- Edge labels name the integration mechanism (`nightly CSV`, `API`, `manual`).

**Rules**
- Use `focal` for the system the decision is about.
- Use `sub` for the product or vendor.
- Use at most 12 systems.

**Example**
```json
{"type":"it-state","title":"Finance today","nodes":[
 {"id":"erp","label":"ERP","sub":"SAP","status":"legacy","row":0,"col":0},
 {"id":"rec","label":"Reconciliation","sub":"Excel","status":"risk","focal":true,"row":0,"col":1}],
 "edges":[["erp","rec","export","primary"]]}
```
