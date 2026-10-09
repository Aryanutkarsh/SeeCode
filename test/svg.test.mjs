// Browser-free SVG export: works with no Chrome (e.g. the Claude.ai sandbox).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { svgFromHtml } from '../skills/seecode/scripts/lib/export/svg.mjs';
import { exampleSpecs } from '../tools/examples.mjs';

for (const ex of exampleSpecs().filter((x) => ['architecture', 'sequence', 'bar', 'sankey', 'venn'].includes(x.type))) {
  test(`svg from html without a browser: ${ex.type}`, () => {
    const r = renderSpec(JSON.parse(readFileSync(ex.path, 'utf8')), { specPath: ex.path });
    const light = svgFromHtml(r.html, { theme: 'light' });
    const dark = svgFromHtml(r.html, { theme: 'dark' });
    assert.match(light, /^<svg [^>]*class="sc-svg sc-still/, 'end frame (motion off)');
    assert.doesNotMatch(light.slice(0, light.indexOf(">")), /data-sc-motion=/, "svg tag has no motion attribute");
    assert.match(light, /<title id="[^"]+-title">/);
    assert.match(light, / width="\d+(\.\d+)?" height="\d+(\.\d+)?"/);
    assert.match(light, /--sc-paper:#f6f5f1/);
    assert.match(dark, /--sc-paper:#1a1a1a/);
    // well-formed enough for XML consumers: no raw "&" or "<" inside the style block
    const style = light.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.doesNotMatch(style, /&(?!amp;|lt;|gt;|quot;)|</);
  });
}

test('exported SVGs scope their styles, so two can share one page', async () => {
  const { scopeCss } = await import('../skills/seecode/scripts/lib/scope.mjs');
  const a = renderSpec({ type: 'architecture', title: 'Same title', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] }).html;
  const b = renderSpec({ type: 'architecture', title: 'Same title', nodes: [{ id: 'x', label: 'X', row: 0, col: 0 }, { id: 'y', label: 'Y', row: 0, col: 1 }], edges: [['x', 'y']] }).html;
  const idOf = (h) => /<svg class="sc-svg[^"]*" id="([^"]+)"/.exec(h)[1];
  assert.notEqual(idOf(a), idOf(b), 'same title, different diagrams, different ids');
  for (const [html, theme] of [[a, 'light'], [b, 'dark']]) {
    const svg = svgFromHtml(html, { theme });
    const id = idOf(html);
    const style = /<style>([\s\S]*?)<\/style>/.exec(svg)[1];
    assert.doesNotMatch(style, /:root\{/, 'no page-wide variables');
    assert.match(style, new RegExp(`#${id}\\{--sc-paper:`), 'variables live on the diagram');
    assert.match(style, new RegExp(`#${id} \\.n-box\\{`), 'rules apply inside the diagram only');
    assert.match(svg, new RegExp(`aria-labelledby="${id}-title ${id}-desc"`));
  }
  assert.equal(scopeCss(':root{--a:1}.sc-svg.x .y{a:b}.n,.m{c:d}@media (max-width:9px){.p{e:f}}@keyframes k{to{opacity:1}}', 'd'),
    '#d{--a:1}#d.sc-svg.x .y{a:b}#d .n,#d .m{c:d}@media (max-width:9px){#d .p{e:f}}@keyframes k{to{opacity:1}}');
});

test('geometry is rounded: no long decimals or exponents in any example', async () => {
  const { roundGeometry } = await import('../skills/seecode/scripts/lib/svg.mjs');
  assert.equal(roundGeometry('M5.204748896376251e-15,-120 L103.92304845413264,-60.00000000000001'), 'M0,-120 L103.92,-60');
  for (const ex of exampleSpecs()) {
    const h = renderSpec(JSON.parse(readFileSync(ex.path, 'utf8')), { specPath: ex.path }).html;
    const svg = h.slice(h.indexOf('<svg class="sc-svg'), h.indexOf('</svg>'));
    const geo = [...svg.matchAll(/ (?:d|points|transform)="([^"]*)"/g)].map((m) => m[1]).join(' ');
    assert.doesNotMatch(geo, /\d\.\d{3,}|\d[eE][-+]?\d/, ex.type);
  }
});
