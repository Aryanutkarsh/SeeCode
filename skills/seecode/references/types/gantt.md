# gantt

Work over time: tasks as bars, with dependencies and milestones.

**Fields**
- `tasks`: `[{id, label, section?, start, end | days, after?, focal?, done?}]`.
  - `after: "id"` starts the task when that task ends; use it with `days`.
  - Dates are `YYYY-MM-DD`, or numbers for relative weeks or days.
- `milestones`: `[{label, date, focal?}]`.
- `today`: draws a dashed "today" line.

**Rules:**
- At most 18 rows. Group rows with `section` (phase or team).
- Mark the critical-path task(s) as `focal`; finished work as `done` (faded, with a ✓).

**Example**
```json
{"type":"gantt","title":"Q3","today":"2026-07-20","tasks":[
 {"id":"d","label":"Design","start":"2026-07-01","days":10,"done":true},
 {"id":"b","label":"Build","after":"d","days":20,"focal":true},{"id":"l","label":"Launch prep","after":"b","days":5}],
 "milestones":[{"label":"GA","date":"2026-08-15"}]}
```

**Motion:** `reveal`. Bars grow left to right in start order, then the milestones pop in.
