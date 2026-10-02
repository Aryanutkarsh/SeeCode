# deployment

Uses the `architecture` spec; see `architecture.md`.

- Use `groups` for hosts, clusters, regions or VPCs, with `"style":"dashed"` for trust boundaries.
- `sub` holds the runtime (`k8s · 3 pods`, `Lambda`, `t3.large`).
- Edges show network paths. Use the label for port or protocol (`:443`, `gRPC`).
