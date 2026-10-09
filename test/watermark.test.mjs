// The SeeCode watermark: on by default in every diagram, removable by spec or
// setting, placed in its own strip, and painted with the diagram's ink colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { svgFromHtml } from '../skills/seecode/scripts/lib/export/svg.mjs';
import { exampleSpecs } from '../tools/examples.mjs';
import { readFileSync } from 'node:fs';

const spec = { type: 'architecture', title: 'Mark', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] };
const vb = (html) => /<svg class="sc-svg[^>]*viewBox="([^"]+)"/.exec(html)[1].split(' ').map(Number);

test('every example type carries the watermark by default', () => {
  for (const ex of exampleSpecs()) {
    const html = renderSpec(JSON.parse(readFileSync(ex.path, 'utf8'))).html;
    assert.match(html, /<g class="sc-mark" aria-hidden="true"/, ex.type);
  }
});

test('removed only when asked: spec or setting', () => {
  assert.doesNotMatch(renderSpec({ ...spec, watermark: false }).html, /class="sc-mark"/);
  assert.doesNotMatch(renderSpec(spec, { settings: { watermark: false } }).html, /class="sc-mark"/);
  // a spec can keep it even when a setting turned it off
  assert.match(renderSpec({ ...spec, watermark: true }, { settings: { watermark: false } }).html, /class="sc-mark"/);
});

test('it gets its own strip, so it never covers the diagram', () => {
  const on = vb(renderSpec(spec).html), off = vb(renderSpec({ ...spec, watermark: false }).html);
  assert.equal(on[3] - off[3], 28);
  assert.equal(on[2], off[2]);
});

test('lettering uses the ink colour; the mark survives SVG export', () => {
  const html = renderSpec(spec).html;
  assert.match(html, /\.sc-mark-word\{fill:var\(--sc-ink\)\}/);
  assert.match(html, /<mask id="mark-[0-9a-z]+-mark"/, "the mask id is unique per diagram");
  const svg = svgFromHtml(html, { theme: 'dark' });
  assert.match(svg, /class="sc-mark"/);
  assert.match(svg, /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/);
  assert.match(svg, /data:image\/png;base64,/);
});
