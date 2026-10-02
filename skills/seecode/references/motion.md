# Motion

Every type animates. The renderer assigns the step order, so the spec only names a preset.

| Preset | What it does |
|---|---|
| `auto` | Uses the family default: trace for graph and sequence types, reveal for trees and charts |
| `reveal` | Elements fade and rise in, step by step |
| `trace` | Like reveal, but edges draw along their path, then one token loops along the primary path |
| `step` | A slower reveal, for walkthroughs |
| `loop` | Like trace, with a looping token |
| `none` | Static |

**Rules**
- At most 12 steps, and about 6.5 s to settle. Motion is pure CSS and never moves layout.
- Reduced-motion, print, `?motion=still` and every static export all show the full end frame.
- The viewer has Live/Still and Replay controls.

**Custom order:** `"order":["user","edge","api"]`. Listed ids come first, in that order; the rest follow by graph depth.
