# sequence

Messages between actors over time.

**Fields**
- `participants[]`: `{id,label,sub?,kind?,focal?}`, listed left to right in the order of first involvement.
- `messages[]`: `["from","to","label","kind?"]`.
  - `kind`: `sync` (default), `reply` (dashed return), `async`, `primary`.
  - Using the same `from` and `to` makes a self call.
- `fragments[]`: `{kind:"alt|opt|loop|par|critical|break",label,from,to,else?,elseLabel?}`. `from`, `to` and `else` are message indexes (0-based).
- `notes[]`: `{at,over:[ids],text}`. The note appears before message `at`.
- `numbered`: `true` numbers the messages.

**Budget:** at most 16 messages and 6 participants. Split long flows by phase.

**Example**
```json
{"type":"sequence","title":"Login","participants":[
 {"id":"u","label":"Browser","kind":"external"},{"id":"api","label":"API","focal":true},{"id":"idp","label":"IdP","kind":"external"}],
 "messages":[["u","api","POST /login"],["api","idp","verify"],["idp","api","token","reply"],["api","u","Set-Cookie","reply"]],
 "fragments":[{"kind":"opt","label":"MFA on","from":1,"to":2}]}
```

**Motion:** `trace`. Each message draws in its own step, and fragments appear with their first message.
