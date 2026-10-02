#!/usr/bin/env node
// Render every example spec into examples/gallery/ and write a browsable index.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderSpec, writeAtomic } from '../skills/seecode/scripts/lib/render.mjs';
import { TYPES } from '../skills/seecode/scripts/lib/types.mjs';
import { FONTS_HREF, skinCss } from '../skills/seecode/scripts/lib/tokens.mjs';
import { exampleSpecs, EXAMPLES, FAMILIES } from './examples.mjs';

const out = join(EXAMPLES, 'gallery');
mkdirSync(out, { recursive: true });
const cards = [];
for (const ex of exampleSpecs()) {
  const spec = JSON.parse(readFileSync(ex.path, 'utf8'));
  const r = renderSpec(spec, { specPath: ex.path });
  if (!r.ok) { console.error(ex.type, r.problems); process.exitCode = 1; continue; }
  writeAtomic(join(out, `${ex.type}.html`), r.html);
  cards.push({ ...ex, name: TYPES[spec.type].name, title: spec.title || TYPES[spec.type].name });
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sections = Object.entries(FAMILIES).map(([fam, label]) => {
  const list = cards.filter((c) => c.family === fam);
  return `<h2 id="${fam}">${label} <span>${list.length}</span></h2><div class="grid">${list.map((c) => `<a class="card" href="${c.type}.html"><iframe src="${c.type}.html?motion=still&amp;embed=1&amp;theme=light" loading="lazy" tabindex="-1" title="${esc(c.title)}"></iframe><div class="meta"><b>${esc(c.name)}</b><code>${c.type}</code></div></a>`).join('')}</div>`;
}).join('');
const nav = Object.entries(FAMILIES).map(([f, l]) => `<a href="#${f}">${l}</a>`).join('');
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SeeCode gallery</title>
<link rel="stylesheet" href="${FONTS_HREF.replace(/&/g, '&amp;')}"><style>${skinCss()}
*{box-sizing:border-box;margin:0}body{background:var(--sc-paper);color:var(--sc-ink);font-family:'IBM Plex Sans',sans-serif;padding:48px 24px}
main{max-width:1240px;margin:0 auto}h1{font-family:'Fraunces',serif;font-weight:400;font-size:40px}p.lead{color:var(--sc-muted);margin:8px 0 18px;max-width:680px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}nav a{font:500 11px/1 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--sc-muted);text-decoration:none;border:1px solid var(--sc-rule);border-radius:999px;padding:7px 12px}nav a:hover{color:var(--sc-accent);border-color:var(--sc-accent)}
h2{font:500 12px/1 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--sc-muted);margin:40px 0 14px;scroll-margin-top:16px}h2 span{color:var(--sc-soft)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{display:block;text-decoration:none;color:inherit;border:1px solid var(--sc-rule);border-radius:10px;overflow:hidden;background:var(--sc-paper)}
.card:hover{border-color:var(--sc-accent)}iframe{width:200%;height:400px;border:0;transform:scale(.5);transform-origin:0 0;margin-bottom:-200px;pointer-events:none;display:block}
.meta{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-top:1px solid var(--sc-rule)}.meta b{font-weight:600;font-size:13px}.meta code{font:11px 'IBM Plex Mono',monospace;color:var(--sc-soft)}
@media (max-width:640px){body{padding:28px 16px}}</style></head><body><main><h1>SeeCode gallery</h1>
<p class="lead">${cards.length} diagram types, each rendered from a short spec in <code>examples/specs/</code>. Open any card to explore it: hover to trace, click to focus, Path for a route journey, ◀ ▶ to step.</p><nav>${nav}</nav>${sections}</main></body></html>`);
console.log(JSON.stringify({ ok: !process.exitCode, rendered: cards.length, gallery: join(out, 'index.html') }));
