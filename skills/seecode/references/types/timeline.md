# timeline

Events positioned in time. Use `gantt` for durations of work, and `process` for steps whose order matters but not their dates.

**Fields**
- `events`: `[{date, label, sub?, focal?, when?}]`.
  - `date` accepts `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, `YYYY-Q2` or a number. Dated events are spaced proportionally; leave out every date to space them evenly.
  - `when` overrides the printed date text.
- `periods`: `[{from, to, label, focal?}]`, eras drawn as bands under the axis.
- `layout`: `"alternate"` (the default; labels go above and below) or `"above"`.

**Rules:** At most 14 events. Labels are 1–3 words. Mark the event the story turns on as `focal`.

**Example**
```json
{"type":"timeline","title":"Launch","events":[{"date":"2026-01","label":"Alpha"},{"date":"2026-04","label":"Beta"},
 {"date":"2026-09","label":"GA","focal":true}],"periods":[{"from":"2026-01","to":"2026-09","label":"build"}]}
```

**Motion:** `trace`. The axis draws first, then the events appear in time order.
