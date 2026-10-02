# fishbone

Root-cause analysis (an Ishikawa diagram). The effect sits at the head, with categories of causes as bones off the spine.

**Fields**
- `effect`: the problem, stated measurably ("p95 > 2s").
- `categories`: `[{label, causes:["…"], focal?}]`. Use 2–6 categories with at most 4 causes each.

**Rules:**
- Causes are short noun phrases.
- Mark the category with the confirmed root cause as `focal`.
- Classic category sets are the 6 Ms (Method, Machine, Material, Man, Measurement, Milieu) or People / Process / Tech.

**Example**
```json
{"type":"fishbone","title":"Flaky deploys","effect":"Deploy fails 1 in 5","categories":[
 {"label":"Pipeline","focal":true,"causes":["shared runners","no retries"]},
 {"label":"Tests","causes":["timing-based","order-dependent"]}]}
```

**Motion:** `trace`. The spine draws first, then each pair of bones.
