# story-map

A user story map: the backbone of activities and steps, with stories sliced into releases.

**Fields**
- `releases`: `["MVP","Next",…]`, listed top to bottom.
- `activities`: `[{label, focal?, steps:[{label, focal?, stories:{"MVP":["…"],"Next":["…"]}}]}]`.

**Rules:** At most 10 steps across the backbone. Steps are verbs in the user's words, and stories are thin vertical slices.

**Example**
```json
{"type":"story-map","title":"Checkout","releases":["MVP","Later"],"activities":[
 {"label":"Buy","steps":[{"label":"Pay","stories":{"MVP":["Card"],"Later":["Wallets"]}},
  {"label":"Confirm","stories":{"MVP":["Email receipt"]}}]}]}
```

**Motion:** `reveal`. The backbone appears first, then each release slice.
