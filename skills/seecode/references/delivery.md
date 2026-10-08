# Delivery: where will the diagram live?

Settle these four questions **before** writing the spec. Destination and audience change the layout, the motion and the export.

| Dial | Options | Default |
|---|---|---|
| **Destination** | page/artifact · doc/PDF · slides · README/wiki · social/chat · video | page/artifact |
| **Look** | light · dark (match the host page or slide theme) · terminal · sketchy | light |
| **Size** | `auto` (doc/page) · `wide` · `slide` (16:9) · `square` (social) | `auto` |
| **Audience** | engineer · mixed · executive. This changes wording and detail level, not just node count | mixed |

**Infer first.** "For my deck" means slides. "In the PDF/report" means doc. "Explain how X works" or "make an artifact" means page. Ask **one** short question only when the destination is unclear *and* it changes the deliverable. Offer choices, for example: *"Where will this live: a standalone interactive page (best for explaining), a doc/PDF, slides, or a README?"* If the user doesn't care, use the defaults and say so in one line.

## Deliverable per destination

| Destination | Deliver | Command |
|---|---|---|
| Explaining how something works, an "artifact", a shareable explorable page, onboarding | **The standalone HTML file** (motion, hover trace, focus passport, route journey, step-through). If you can publish pages or artifacts, publish this file as-is; never re-draw it. | `SC render` only |
| PDF, Word, printed handout, LaTeX | **SVG** (vector, fonts embedded) + PNG@3 fallback, end frame, diagram only | `SC export x.html --for pdf` (or `word`, `print`) |
| Google Docs / Google Slides (no SVG support) | PNG@3 | `--for gdocs` / `--for gslides` |
| PowerPoint / Keynote | SVG + PNG@2. Use `"size":"slide"`, plus `"skin":"dark"` on dark templates | `--for slides` |
| README / GitHub / docs site / Notion / Confluence | SVG (+ PNG). For motion in a README or Notion, add a GIF | `--for readme` (+ `--for animated`) |
| Figma / design hand-off | SVG | `--for figma` |
| X / LinkedIn / Slack post | PNG with the title (`"size":"square"` for feeds) | `--for social` |
| Video / talk / tweet with motion | MP4 + GIF | `--for video` |

**Rules**
- **Highest quality wins.** For static embeds prefer SVG (it scales without blur and keeps text selectable). Use PNG only where the host refuses SVG (scale 3 for print and PDF; otherwise export sizes itself from the content).
- **Embeds are diagram-only.** The doc supplies its own heading (`crop: diagram`). Social images keep the title (`crop: figure`).
- **Static formats show the finished picture**, after all motion has played. Animation only survives in HTML, GIF, MP4 and WebM, so don't promise motion inside a PDF.
- **Keep the HTML when you also export.** Mention it as the interactive version ("open `x.html` to explore").
- **Ask about a mismatch once.** If the user asks for an interactive explanation inside a PDF, explain that a PDF can't animate, then offer two options: put the SVG in the PDF and link the HTML, or use HTML only.

## Everyday subjects

Plans, moves, money and applications use the same types as systems:

| Subject | Type |
|---|---|
| A trip, leave or project plan | `timeline`, `gantt`, `journey` |
| Steps to get something done (visa, move, onboarding) | `process`, `flowchart` |
| A back-and-forth (renting, a claim, negotiating) | `sequence` |
| Where money goes, a budget | `sankey`, `treemap`, `waterfall` |
| Where an application or order stands | `state`, `kanban` |
| Weighing options | `quadrant`, `bar` |

Write labels in the reader's words ("Pay deposit", not "POST /deposit"), and rename the legend to match. Ask for missing personal facts (dates, amounts, rules) and never invent them; leave a clearly marked placeholder if the user wants a draft now.

## No browser where you run (e.g. the Claude.ai sandbox)
`export --formats svg` (including `--for pdf|figma`) works without a browser. PNG, GIF and MP4 from the CLI need one. If `export` reports no browser, deliver the HTML plus the SVG, and tell the user to choose **Export → PNG / GIF / MP4** in the diagram itself: it renders those formats in their own browser.
