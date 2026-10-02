# journey

A user journey: stages, the steps within them, and how the user feels at each one.

**Fields**
- `stages`: `[{label, sub?, steps:[{label, score:-2..2, pain?, focal?, note?}]}]`.
  - `score`: 2 is delight, 0 is neutral, -2 is frustration. A step with `-2` or `pain:true` is accented as a pain point.
  - `note`: a short italic callout at that point ("needs doctor").

**Rules:** At most 7 stages and 14 steps. Each step is written in the user's words ("Can't find export"). Add a `note` only to the 1–3 moments that matter.

**Example**
```json
{"type":"journey","title":"Onboarding","stages":[
 {"label":"Sign up","steps":[{"label":"Lands on site","score":1},{"label":"Email verify","score":-2,"note":"slow email"}]},
 {"label":"Activate","steps":[{"label":"First project","score":2,"focal":true}]}]}
```

**Motion:** `trace`. The stages fade in, the emotion curve draws, then the points pop in.
