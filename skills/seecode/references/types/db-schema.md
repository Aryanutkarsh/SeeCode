# db-schema

Physical tables, with typed columns and foreign-key lines between them.

**Nodes:** `{id,label,tag?:"TABLE",fields:[["col","type","PK|FK|UQ"],…],row,col}`. A string field such as `"col type FK"` also works.

**Edges:** `["table.col","table.col","","many-one"]`. The line attaches to those exact column rows. Use `many-one` for FK → PK.

**Placement**
- A referencing table sits beside the table it references, not stacked above it, so the lines run horizontally.
- Keep it to at most 8 tables per diagram; split by domain.

**Example**
```json
{"type":"db-schema","title":"Billing","nodes":[
 {"id":"accounts","label":"accounts","fields":[["id","uuid","PK"]],"row":0,"col":0},
 {"id":"invoices","label":"invoices","focal":true,"fields":[["id","uuid","PK"],["account_id","uuid","FK"]],"row":0,"col":1}],
 "edges":[["invoices.account_id","accounts.id","","many-one"]]}
```

From SQL, Prisma or DBML files: `SC import schema.sql` writes this spec for you.
