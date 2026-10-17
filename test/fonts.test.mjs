// The fonts setting: Google Fonts by default; 'system' leaves the stylesheet
// out of the page, the folder index and the SVG export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { svgFromHtml, exportSvg } from '../skills/seecode/scripts/lib/export/svg.mjs';
import { indexHtml } from '../skills/seecode/scripts/lib/folder.mjs';
import * as config from '../skills/seecode/scripts/lib/config/config.mjs';

const spec = { type: 'architecture', title: 'Fonts', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] };
// every src/href attribute that points at another host
const external = (html) => [...html.matchAll(/\s(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);

test('Google Fonts are linked by default', () => {
  const html = renderSpec(spec).html;
  assert.match(html, /<link id="sc-fonts" rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\//);
  assert.match(svgFromHtml(html), /@import url\('https:\/\/fonts\.googleapis\.com\//);
});

test("fonts: 'system' leaves every external reference out, by spec or setting", () => {
  for (const html of [renderSpec({ ...spec, fonts: 'system' }).html, renderSpec(spec, { settings: { fonts: 'system' } }).html]) {
    assert.deepEqual(external(html), []);
    assert.doesNotMatch(html, /id="sc-fonts"|rel="preconnect"/);
    assert.match(html, /--sc-font-sans:/, 'the font stacks, and so the system fallbacks, stay');
  }
  // a spec can ask for web fonts even when the setting turned them off
  assert.match(renderSpec({ ...spec, fonts: 'google' }, { settings: { fonts: 'system' } }).html, /id="sc-fonts"/);
});

test('the sketchy style follows the setting too', () => {
  assert.deepEqual(external(renderSpec({ ...spec, style: 'sketchy', fonts: 'system' }).html), []);
});

test('SVG export makes no font request and gives no warning', async (t) => {
  const html = renderSpec({ ...spec, fonts: 'system' }).html;
  assert.doesNotMatch(svgFromHtml(html), /@import/);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('no request expected'); });
  const out = await exportSvg(html);
  assert.equal(out.warning, null);
  assert.doesNotMatch(out.svg, /fonts\.googleapis\.com/);
});

test('the folder index follows the setting', () => {
  const cards = [{ href: 'a.html', title: 'A', type: 'architecture' }];
  assert.match(indexHtml('set', cards), /fonts\.googleapis\.com/);
  assert.deepEqual(external(indexHtml('set', cards, { fonts: 'system' })).filter((u) => /^https?:/.test(u)), []);
});

test('config accepts google and system only', () => {
  process.env.SEECODE_HOME = mkdtempSync(join(tmpdir(), 'sc-home-'));
  const proj = mkdtempSync(join(tmpdir(), 'sc-proj-'));
  config.init(proj, 'project');
  assert.equal(config.status(proj).settings.fonts, 'google');
  assert.equal(config.set(proj, 'fonts', 'system').settings.fonts, 'system');
  assert.throws(() => config.set(proj, 'fonts', 'none'), /fonts must be one of/);
});
