# dp-integration

How source systems integrate into a data platform, and who consumes the result. The spec shape is the same as `medallion` (`stages`).

**Typical stages:** source systems (`plain`, `kind:"external"`) → integration (CDC, API pulls, files, streams) → platform → serving (BI, ML, reverse ETL).

**Edges:** give explicit edges when the sources fan into specific connectors. Use `id`s on items so edges can refer to them, and mark the platform's main inflows `primary`.

**Example**
```json
{"type":"dp-integration","title":"Ingestion","stages":[
 {"label":"Sources","plain":true,"kind":"external","items":[{"id":"crm","label":"CRM"},{"id":"erp","label":"ERP"}]},
 {"label":"Integration","items":[{"id":"cdc","label":"CDC","sub":"Debezium"}]},
 {"label":"Platform","items":[{"id":"lake","label":"Lakehouse","focal":true}]}],
 "edges":[["crm","cdc"],["erp","cdc"],["cdc","lake","","primary"]]}
```
