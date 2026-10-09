---
description: Export a SeeCode diagram for a destination (pdf, docs, readme, slides, gdocs, social, video…)
argument-hint: <diagram.html | folder> [destination]
---
Export the SeeCode diagram `$1` for the destination `$2` (if no destination is given, ask where it will be used, following `references/delivery.md`).

Run: `node "${CLAUDE_PLUGIN_ROOT}/skills/seecode/scripts/seecode.mjs" export "$1" --for <destination>`

`$1` can also be a folder of diagrams (from `import --all`): every diagram is exported next to its own HTML. Add `--zip` if the user wants one file to share.

Destinations: pdf, print, word, docs, gdocs, notion, confluence, readme, slides, gslides, figma, social, video, animated. Report the files produced (one line each) and remind the user the HTML is the interactive version.
