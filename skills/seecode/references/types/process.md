# process

A short linear procedure, shown as numbered chevrons. Use `flowchart` instead when there are branches, or `swimlane` when it matters who does each step.

**Fields**
- `steps`: `["label", …]`, or `{label, sub?, focal?}`. Use 2–7 steps.
- `numbered`: `false` hides the `01 02 …` numbers.

**Rules**
- Each label is a 1–3 word verb phrase. `sub` holds the tool or the output of the step.
- Mark the step the reader should remember as `focal`.

**Example**
```json
{"type":"process","title":"Release","steps":["Branch","Review",{"label":"Ship","focal":true,"sub":"canary 5%"},"Observe"]}
```

**Motion:** `step`. The chevrons appear one at a time, left to right.
