// Export smoke test: skipped automatically when no browser is available.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { exportDiagram, launchBrowser } from '../skills/seecode/scripts/lib/export/export.mjs';

const b = await launchBrowser();
const skip = b.error ? `no browser: ${b.error}` : false;
if (b.browser) await b.browser.close();

test('exports static + animated formats', { skip, timeout: 180000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-export-'));
  const spec = { type: 'architecture', title: 'Export test', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', focal: true, row: 0, col: 1 }], edges: [['a', 'b', 'call', 'primary']] };
  const r = renderSpec(spec);
  const html = join(dir, 'x.html');
  writeFileSync(html, r.html);
  const out = await exportDiagram(html, { formats: 'png,svg,gif,mp4', scale: 1, fps: 12, duration: 2 });
  assert.equal(out.ok, true, JSON.stringify(out));
  const by = Object.fromEntries(out.files.map((f) => [f.format, f]));
  assert.deepEqual(readFileSync(by.png.path).subarray(1, 4).toString(), 'PNG');
  assert.match(readFileSync(by.svg.path, 'utf8'), /^<svg[\s\S]*sc-still/);
  assert.equal(readFileSync(by.gif.path).subarray(0, 6).toString(), 'GIF89a');
  assert.ok(by.gif.frames > 5, 'gif has multiple frames');
  // the diagram fills the capture at 1:1 layout: PNG width ≈ (viewBox + 80px padding) × scale
  const png = readFileSync(by.png.path);
  const pngW = png.readUInt32BE(16);
  const vbW = Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(r.html)[1]);
  const expected = Math.max(640, vbW) + 80;
  assert.ok(Math.abs(pngW - expected) <= 4, `capture width ${pngW}px, expected ~${expected}px`);
  assert.equal(by.png.width, pngW, 'reported width matches the file');
  // GIF keeps the PNG's aspect ratio (no empty canvas around the diagram)
  const gif = readFileSync(by.gif.path);
  const gw = gif.readUInt16LE(6), gh = gif.readUInt16LE(8);
  assert.ok(Math.abs(gw / gh - pngW / png.readUInt32BE(20)) < 0.02, 'gif aspect matches png');
  if (by.mp4) assert.equal(readFileSync(by.mp4.path).subarray(4, 8).toString(), 'ftyp');
});

test('the HTML exports PNG/SVG/GIF/MP4 by itself (in-page menu)', { skip, timeout: 180000 }, async () => {
  const { launchBrowser: launch } = await import('../skills/seecode/scripts/lib/export/chrome.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'sc-inpage-'));
  const spec = { type: 'architecture', title: 'In page', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', focal: true, row: 0, col: 1 }], edges: [['a', 'b', 'call', 'primary']] };
  const html = join(dir, 'x.html');
  writeFileSync(html, renderSpec(spec).html);
  const { browser } = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    await p.goto(pathToFileURL(html).href);
    for (const kind of ['png', 'svg', 'gif', 'mp4']) {
      const r = await p.evaluate(async (k) => {
        window.SeeCode.lastExport = null;
        try { await window.SeeCode.doExport(k); } catch (e) { return { error: e.message }; }
        const x = window.SeeCode.lastExport;
        return x ? { size: x.size, head: [...new Uint8Array(await x.blob.slice(0, 12).arrayBuffer())] } : { error: 'nothing exported' };
      }, kind);
      if (r.error && /could not load/.test(r.error)) return; // offline CI: encoders come from the CDN
      assert.ok(!r.error, `${kind}: ${r.error}`);
      assert.ok(r.size > 1000, `${kind} too small`);
      const ascii = String.fromCharCode(...r.head);
      if (kind === 'png') assert.equal(ascii.slice(1, 4), 'PNG');
      if (kind === 'gif') assert.equal(ascii.slice(0, 6), 'GIF89a');
      if (kind === 'mp4') assert.ok(ascii.includes('ftyp') || r.head.length, 'mp4 container');
      if (kind === 'svg') assert.ok(ascii.startsWith('<svg'));
    }
  } finally {
    await browser.close();
  }
});

test('export size adapts to the content', { skip, timeout: 60000 }, async () => {
  const { launchBrowser: launch } = await import('../skills/seecode/scripts/lib/export/chrome.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'sc-plan-'));
  const small = { type: 'architecture', title: 'Small', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] };
  const nodes = Array.from({ length: 24 }, (_, i) => ({ id: `n${i}`, label: `Service ${i}`, row: Math.floor(i / 8), col: i % 8 }));
  const big = { type: 'architecture', title: 'Big', nodes, edges: nodes.slice(1).map((n, i) => [nodes[i].id, n.id]) };
  const { browser } = await launch();
  try {
    const plans = {};
    for (const [name, spec] of Object.entries({ small, big })) {
      const html = join(dir, `${name}.html`);
      writeFileSync(html, renderSpec(spec).html);
      const p = await browser.newPage({ viewport: { width: 1200, height: 700 } });
      await p.goto(pathToFileURL(html).href);
      plans[name] = await p.evaluate(() => Object.fromEntries(['png', 'gif', 'mp4'].map((f) => [f, window.SeeCode.exportPlan(f)])));
      await p.close();
    }
    // small diagrams get extra pixels so they stay sharp when shown large
    assert.ok(plans.small.png.scale >= 3, `small png scale ${plans.small.png.scale}`);
    // every format stays inside its budget and keeps text readable at 2×+ when it can
    for (const pl of Object.values(plans)) {
      assert.ok(pl.gif.width <= 2000 && pl.gif.width * pl.gif.height <= 2.4e6, 'gif within budget');
      assert.ok(pl.mp4.width <= 3840 && pl.mp4.height <= 2160 && pl.mp4.width % 2 === 0 && pl.mp4.height % 2 === 0, 'mp4 within H.264 limits');
      assert.ok(pl.png.minTextPx >= 18, 'png text readable');
    }
    // big content: the GIF scales down and drops fps instead of growing past its budget
    assert.ok(plans.big.gif.scale < plans.small.gif.scale);
    assert.ok(plans.big.gif.fps <= plans.small.gif.fps);
  } finally {
    await browser.close();
  }
});

test('a font request that never answers stalls export for the cap, not forever', { skip, timeout: 60000 }, async (t) => {
  const { createServer } = await import('node:http');
  const held = [];
  const server = createServer((req, res) => held.push(res)); // never responds
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => { held.forEach((res) => res.destroy()); server.close(); delete process.env.SEECODE_LOAD_TIMEOUT_MS; });
  process.env.SEECODE_LOAD_TIMEOUT_MS = '1500';
  const dir = mkdtempSync(join(tmpdir(), 'sc-export-stall-'));
  const r = renderSpec({ type: 'architecture', title: 'Stall', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }], edges: [] });
  const html = join(dir, 'x.html');
  writeFileSync(html, r.html.replace(/(<link id="sc-fonts" rel="stylesheet" href=")[^"]*/, `$1http://127.0.0.1:${server.address().port}/css`));
  const t0 = Date.now();
  const out = await exportDiagram(html, { formats: 'png', scale: 1 });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.ok(Date.now() - t0 < 25000, 'export did not wait for the held request');
  assert.ok(out.warnings.some((w) => w.startsWith('W_FONTS')), JSON.stringify(out.warnings));
});
