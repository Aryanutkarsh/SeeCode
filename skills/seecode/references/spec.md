# Spec envelope and patching

**Shared fields (every type)**
- `type` (required).
- `title`, `subtitle`, `eyebrow` (`""` hides it), `caption`.
- `motion`: `auto` | `none` | `reveal` | `trace` | `step` | `loop`.
- `order`: ids, to script the motion sequence.
- `skin`: `light` | `dark` | `terminal`. The page has its own light/dark toggle.
- `size`: `auto` | `wide` | `slide` | `square`.
- `budget`: `strict` | `balanced` (default) | `faithful` (imports, up to 24 nodes) | `off`.
- `legend`: `false` hides it.
- `evidence`: `[{id,file,line?,note?}]`.
- `out`: the output path, relative to the spec.

**Problems**: `{code,at,msg,fix}`.
- `E_` blocks rendering.
- `W_` renders, but should be fixed. `W_ROUTE_*` (stacked, crowded, border-riding or diagonal connectors) is fixed by moving a node one row/col, as its `fix` says.
- `I_` is optional.

**Patch** (`--patch '<json>'`; the patch is merged into the spec file and saved):
- Objects merge, and `null` deletes a field.
- Arrays of objects with `id` patch by id: `{"nodes":{"api":{"row":2},"old":null,"new":{"label":"New","row":0,"col":4}}}`.
- Tuple arrays add or remove items: `{"edges":{"add":[["a","b","label"]],"remove":["c>d"]}}`. `remove` also accepts indexes.

**Watermark:** every diagram carries the SeeCode logo in its bottom-right corner, in all formats. The lettering takes the diagram's text colour, so it stays visible on any background. Keep it unless the user asks to remove it; then set `"watermark": false` in the spec, or `SC config set watermark false` for all diagrams.
