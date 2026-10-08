#!/usr/bin/env node
// Records the README's feature GIFs from real interactions with the viewer:
// a headless browser moves a drawn cursor, hovers and clicks, and the page is
// captured in real time, then encoded with the bundled gifenc.
// Usage: node tools/feature-gifs.mjs [scene …]   →   docs/features/<scene>.gif
// SC_DUMP=<dir> also writes five sample frames per scene for review.
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { launchBrowser } from '../skills/seecode/scripts/lib/export/chrome.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/features');
const VIEW = { width: 1000, height: 640 };
// 1× on purpose: headless Chrome's renderer crashes when screenshots are taken
// continuously at a fractional pixel ratio (1.25, 1.5) while the viewer animates.
const DSF = 1;
const FPS = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a visible cursor: headless screenshots don't include the system pointer
const CURSOR = `(() => {
  const c = document.createElement('div');
  c.id = '__cursor';
  c.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))';
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid #2f54eb;opacity:0;transition:opacity .35s,transform .35s;transform:scale(.4)';
  document.documentElement.append(ring, c);
  addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 2) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
  addEventListener('mousedown', (e) => {
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    ring.style.transition = 'none'; ring.style.opacity = '1'; ring.style.transform = 'scale(.4)';
    requestAnimationFrame(() => { ring.style.transition = 'opacity .45s, transform .45s'; ring.style.opacity = '0'; ring.style.transform = 'scale(1.3)'; });
  }, true);
})()`;

function actor(page) {
  let pos = { x: VIEW.width - 120, y: 420 };
  const mouse = (type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  const center = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }, sel);
  return {
    async move(target, ms = 650) {
      const to = typeof target === 'string' ? await center(target) : target;
      if (!to) throw new Error(`not found: ${target} (viewer said: ${await page.evaluate(() => document.querySelector('.sc-status')?.textContent)})`);
      const from = pos, n = Math.max(6, Math.round(ms / 25));
      for (let i = 1; i <= n; i++) {
        const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        await mouse('mouseMoved', from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        await sleep(ms / n);
      }
      pos = to;
      // the layout can shift while the cursor travels (status text, panels): re-aim
      if (typeof target === 'string') {
        const now = await center(target);
        if (now && (now.x !== to.x || now.y !== to.y)) { await mouse('mouseMoved', now.x, now.y); pos = now; }
      }
    },
    async click(target, ms) {
      if (target) await this.move(target, ms);
      await mouse('mousePressed', pos.x, pos.y, { clickCount: 1 });
      await sleep(70);
      await mouse('mouseReleased', pos.x, pos.y, { clickCount: 1 });
    },
    // press on a target, travel by (dx, dy), release (e.g. the canvas grip)
    async drag(target, dx, dy, ms = 900) {
      await this.move(target);
      await mouse('mousePressed', pos.x, pos.y, { clickCount: 1 });
      const from = pos, n = Math.max(8, Math.round(ms / 25));
      for (let i = 1; i <= n; i++) {
        const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        await mouse('mouseMoved', from.x + dx * e, from.y + dy * e, { buttons: 1 });
        await sleep(ms / n);
      }
      pos = { x: from.x + dx, y: from.y + dy };
      await mouse('mouseReleased', pos.x, pos.y, { clickCount: 1 });
    },
    async key(key) {
      const code = { ArrowRight: 39, ArrowLeft: 37, Escape: 27 }[key];
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    },
    hold: sleep,
  };
}

// Each scene: which example to open, and what a person would do with it.
const SCENES = {
  trace: { spec: 'systems/architecture', async play(a) {
    await a.hold(700);
    await a.move('[data-sc-node="web"]'); await a.hold(1700);
    await a.move('[data-sc-node="api"]'); await a.hold(2300);
    await a.move('[data-sc-node="queue"]'); await a.hold(1800);
    await a.move({ x: 940, y: 300 }); await a.hold(700);
  } },
  focus: { spec: 'systems/architecture', async play(a) {
    await a.hold(500);
    await a.click('[data-sc-node="api"]'); await a.hold(2200);
    await a.move('.sc-panel .sc-rel'); await a.hold(1600);
    await a.move('.sc-panel .sc-rel:nth-of-type(3)'); await a.hold(1500);
    await a.click('.sc-panel [data-act="down"]'); await a.hold(2400);
  } },
  route: { spec: 'systems/architecture', async play(a) {
    await a.hold(500);
    await a.click('[data-sc-action="path"]'); await a.hold(500);
    await a.click('[data-sc-node="web"]'); await a.hold(500);
    await a.click('[data-sc-node="mail"]'); await a.hold(900);
    await a.click('.sc-panel [data-act="play"]'); await a.hold(6200);
  } },
  lens: { spec: 'systems/architecture', async play(a) {
    await a.hold(500);
    await a.click('[data-sc-action="lens"]'); await a.hold(500);
    await a.click('.sc-lens [data-ek="async"]'); await a.hold(2200);
    await a.click('[data-sc-action="lens"]'); await a.hold(450);
    await a.click('.sc-lens [data-ek="primary"]'); await a.hold(2400);
  } },
  step: { spec: 'process/sequence', async play(a) {
    await a.hold(600);
    for (let i = 0; i < 7; i++) { await a.key('ArrowRight'); await a.hold(750); }
    await a.hold(900);
  } },
  canvas: { spec: 'systems/architecture', async play(a) {
    await a.hold(500);
    await a.drag('.sc-grip', 0, 70); await a.hold(900);
    await a.click('[data-sc-action="full"]'); await a.hold(1200);
    await a.click('[data-sc-action="zoom-in"]', 500); await a.hold(350);
    await a.click('[data-sc-action="zoom-in"]', 200); await a.hold(1400);
    await a.key('Escape'); await a.hold(1000);
  } },
  export: { spec: 'systems/architecture', async play(a) {
    await a.hold(500);
    await a.click('[data-sc-action="theme"]'); await a.hold(1400);
    await a.click('[data-sc-action="export"]'); await a.hold(600);
    await a.move('[data-sc-export="gif"]'); await a.hold(1600);
  } },
};

async function record(browser, name, scene, dir) {
  const html = join(dir, `${name}.html`);
  writeFileSync(html, renderSpec(JSON.parse(readFileSync(join(ROOT, 'examples/specs', `${scene.spec}.json`), 'utf8'))).html);
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: DSF, colorScheme: 'light' });
  await page.goto(`file://${html}?theme=light`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(CURSOR);
  // fit the capture to the page, so the diagram fills the GIF
  const h = await page.evaluate(() => Math.ceil(document.querySelector('.sc-page').getBoundingClientRect().bottom + 12));
  await page.setViewportSize({ width: VIEW.width, height: Math.min(900, h) });
  // start each GIF on the finished diagram: wait out the build-up animation
  const settle = await page.evaluate(() => Math.max(0, ...document.getAnimations().map((a) => a.effect.getComputedTiming()).filter((t) => t.iterations !== Infinity).map((t) => t.endTime || 0)));
  await sleep(Math.min(9000, settle) + 300);
  const frames = [];
  let done = false;
  const loop = (async () => {
    const t0 = Date.now();
    for (let i = 0; !done; i++) {
      const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      frames.push({ t: Date.now() - t0, data: r.data });
      const wait = t0 + ((i + 1) * 1000) / FPS - Date.now();
      if (wait > 0) await sleep(wait);
    }
  })();
  await scene.play(actor(page));
  done = true;
  await loop;
  if (page.errors.length) throw new Error(`${name}: ${page.errors[0]}`);
  await page.close();
  return frames;
}

async function encode(browser, frames) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  await page.evaluate(`(function(){var exports={};var module={exports};${readFileSync(join(ROOT, 'skills/seecode/scripts/vendor/gifenc.js'), 'utf8')};window.gifenc=module.exports&&Object.keys(module.exports).length?module.exports:exports;})();window.__f=[];true`);
  for (const f of frames) await page.evaluate(async (b64) => { window.__f.push(await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob())); }, f.data);
  const delays = frames.map((f, i) => (i < frames.length - 1 ? frames[i + 1].t - f.t : 1600));
  const b64 = await page.evaluate(async (delays) => {
    const { GIFEncoder, quantize, applyPalette } = window.gifenc;
    const fr = window.__f, w = fr[0].width, h = fr[0].height;
    const g = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    // one palette from frames sampled across the clip, so overlays keep their colours
    const picks = [0, 0.25, 0.5, 0.75, 1].map((p) => fr[Math.round(p * (fr.length - 1))]);
    const all = new Uint8ClampedArray(w * h * 4 * picks.length);
    picks.forEach((bmp, i) => { g.drawImage(bmp, 0, 0); all.set(g.getImageData(0, 0, w, h).data, i * w * h * 4); });
    const palette = quantize(all, 255);
    while (palette.length < 255) palette.push([0, 0, 0]);
    palette.push([255, 0, 255]);
    const gif = GIFEncoder();
    let prev = null;
    fr.forEach((bmp, i) => {
      g.drawImage(bmp, 0, 0);
      const idx = applyPalette(g.getImageData(0, 0, w, h).data, palette.slice(0, 255));
      let out = idx;
      if (prev) { out = new Uint8Array(idx.length); for (let p = 0; p < idx.length; p++) out[p] = idx[p] === prev[p] ? 255 : idx[p]; }
      gif.writeFrame(out, w, h, { palette: i === 0 ? palette : undefined, delay: delays[i], repeat: 0, transparent: i > 0, transparentIndex: 255, dispose: 1 });
      prev = idx;
    });
    gif.finish();
    const u8 = gif.bytes();
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, delays);
  await page.close();
  return Buffer.from(b64, 'base64');
}

const wanted = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'sc-features-'));
const { browser, error } = await launchBrowser();
if (error) { console.error(error); process.exit(1); }
try {
  for (const [name, scene] of Object.entries(SCENES).filter(([n]) => !wanted.length || wanted.includes(n))) {
    const frames = await record(browser, name, scene, dir);
    if (process.env.SC_DUMP) {
      mkdirSync(process.env.SC_DUMP, { recursive: true });
      [0.1, 0.3, 0.5, 0.7, 0.9].forEach((p, i) => writeFileSync(join(process.env.SC_DUMP, `${name}-${i}.jpg`), Buffer.from(frames[Math.round(p * (frames.length - 1))].data, 'base64')));
    }
    const gif = await encode(browser, frames);
    writeFileSync(join(OUT, `${name}.gif`), gif);
    console.log(JSON.stringify({ scene: name, frames: frames.length, kb: Math.round(gif.length / 1024) }));
  }
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
