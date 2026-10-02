# Diagramming real code

1. Run `SC scan <dir> [--depth 3]`. You get:
   - `langs`
   - `manifests` (with dependencies)
   - `entrypoints`
   - `modules` (with `uses`, the imports between modules)
   - `tech` (databases, queues and SDKs, with file:line)
   - `infra` (compose, Docker, Terraform, k8s, CI)
2. Draft the nodes from `modules`, `tech` and `infra`, and the edges from `uses`, entrypoints and infra links.
3. Confirm only what is uncertain. Open at most about 5 files, and read the cited lines rather than whole files.
4. Add `evidence` for each non-obvious node or edge: `{"id":"api","file":"src/server.ts","line":12}`. The viewer lists the sources under the diagram.
5. Don't invent components. If something is inferred rather than seen, set its `kind` to `optional` (dashed) and say so in your reply.
