# Style guide (editorial rules)

The renderer enforces most of these rules. These are the ones you control through the spec.

- **The best edit is usually a deletion.** Two nodes that always travel together are one node. An edge that the layout already makes obvious can go.
- **One accent.** Use `focal` on 1–2 elements and `primary` on the main path. Everything else stays neutral.
- **Type does the work:**
  - Names are short (1–3 words).
  - Technical detail goes in `sub` (port, tech, path).
  - Edge labels are 1–2 words.
  - Don't put sentences inside boxes; use `caption` for prose.
- **Density:**
  - Aim for about 7 elements.
  - Past 9 nodes or 12 edges, split the diagram into an overview plus details.
  - Charts allow more, but have one point to make.
- **Skins** (set in the spec or in settings):
  - `light` (default): warm paper with an ink and cobalt accent.
  - `dark`.
  - `terminal`: a CLI window with a green accent.
  - Viewers can switch light and dark themselves.
- **Style:** `"style":"sketchy"` gives a hand-drawn look for informal docs and talks.
- **Size:** `size` is `auto` (≤ 1200px), `wide`, `slide` (16:9 decks) or `square` (social posts).
- **Brand:** see `onboarding.md`. Keep the brand accent as the only accent.
