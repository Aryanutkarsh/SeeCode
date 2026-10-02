# loop-terminal

A reinforcing cycle or flywheel, where every step feeds the next and the last one feeds the first.

**Fields**
- `steps`: 3–8 items, either `"label"` or `{label, sub?, focal?}`. They are listed clockwise, starting from the top.
- `center`, `centerSub` (optional): what the loop grows, written in the middle.
- `"skin":"terminal"`: the terminal look (the `loop-terminal` variant).

**Rules:** Phrase every step as an action. Mark the step that most needs investment as `focal`; its arcs are accented.

**Example**
```json
{"type":"loop","title":"Growth loop","center":"Users","steps":["Create","Share",{"label":"Invite","focal":true},"Sign up"]}
```

**Motion:** `loop`. The ring draws in step by step, then a token keeps circling.

This variant is the same spec as `loop` with `"skin":"terminal"`, a dark CLI-window look.
