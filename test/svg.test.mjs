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
