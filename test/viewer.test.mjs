// Viewer canvas controls in a real browser: the resize grip and full screen.
// Skipped automatically when no browser is available.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { launchBrowser } from '../skills/seecode/scripts/lib/export/export.mjs';

const b = await launchBrowser();
const skip = b.error ? `no browser: ${b.error}` : false;
if (b.browser) await b.browser.close();

const spec = { type: 'architecture', title: 'Canvas', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] };

async function open(query = '') {
  const dir = mkdtempSync(join(tmpdir(), 'sc-viewer-'));
  const html = join(dir, 'x.html');
  writeFileSync(html, renderSpec(spec).html);
  const { browser } = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`${pathToFileURL(html).href}?motion=still${query}`);
  return { browser, page };
}

const key = (k) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`;
const state = `(() => {
  const s = document.querySelector('.sc-stage').getBoundingClientRect(), v = document.querySelector('.sc-svg').getBoundingClientRect();
  const btn = document.querySelector('[data-sc-action="full"]');
  return { full: document.querySelector('.sc-page').classList.contains('sc-full'), stage: [s.width, s.height], svg: [v.width, v.height], label: btn.textContent, pressed: btn.getAttribute('aria-pressed') };
})()`;

test('full screen fills the window and exits with Esc or F', { skip, timeout: 60000 }, async (t) => {
  const { browser, page } = await open();
  t.after(() => browser.close());
  const before = await page.evaluate(state);
  assert.equal(before.full, false);
  await page.evaluate(`document.querySelector('[data-sc-action="full"]').click()`);
  const on = await page.evaluate(state);
  assert.equal(on.full, true);
  assert.equal(on.pressed, 'true');
  assert.match(on.label, /Exit/);
  assert.ok(on.stage[0] > 1100 && on.stage[1] > before.stage[1], `stage ${on.stage} grew from ${before.stage}`);
  assert.ok(Math.abs(on.svg[1] - on.stage[1]) < 2, 'diagram fills the stage');
  await page.evaluate(key('Escape'));
  assert.equal((await page.evaluate(state)).full, false);
  await page.evaluate(key('f'));
  assert.equal((await page.evaluate(state)).full, true);
  await page.evaluate(key('F'));
  const off = await page.evaluate(state);
  assert.equal(off.full, false);
  assert.deepEqual(off.stage, before.stage, 'leaving full screen restores the page layout');
});

test('typing f in the search box does not toggle full screen', { skip, timeout: 60000 }, async (t) => {
  const { browser, page } = await open();
  t.after(() => browser.close());
  await page.evaluate(`document.querySelector('.sc-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))`);
  assert.equal((await page.evaluate(state)).full, false);
});

test('the grip makes the canvas taller and the diagram fills it; Home resets', { skip, timeout: 60000 }, async (t) => {
  const { browser, page } = await open();
  t.after(() => browser.close());
  const before = await page.evaluate(state);
  const grip = `document.querySelector('.sc-grip')`;
  for (let i = 0; i < 3; i++) await page.evaluate(`${grip}.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
  const grown = await page.evaluate(state);
  assert.ok(Math.abs(grown.stage[1] - (before.stage[1] + 120)) < 2, `stage ${grown.stage[1]} = ${before.stage[1]} + 120`);
  assert.ok(Math.abs(grown.svg[1] - grown.stage[1]) < 2, 'diagram fills the taller stage');
  await page.evaluate(`${grip}.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))`);
  assert.deepEqual((await page.evaluate(state)).stage, before.stage);
});

test('embedded diagrams show no grip', { skip, timeout: 60000 }, async (t) => {
  const { browser, page } = await open('&embed=1');
  t.after(() => browser.close());
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.sc-grip')).display`), 'none');
});
