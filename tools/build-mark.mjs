#!/usr/bin/env node
// Builds the diagram watermark assets from the approved branding artwork:
//   skills/seecode/assets/mark-symbol.png  tan lighthouse symbol, trimmed, 96 px tall
//   skills/seecode/assets/mark-word.png    "SeeCode" lettering as a white alpha mask, 64 px tall
// The lettering is a mask so diagrams can paint it in their own ink colour,
// which keeps it legible on light, dark and brand backgrounds alike.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../skills/seecode/scripts/lib/export/chrome.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'skills/seecode/assets');
mkdirSync(OUT, { recursive: true });

const { browser, error } = await launchBrowser();
if (error) { console.error(error); process.exit(1); }
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  await page.goto('about:blank');
  const jobs = [
    { src: 'branding/logo.png', out: 'mark-symbol.png', height: 96, white: false },
    { src: 'branding/text-dark.png', out: 'mark-word.png', height: 64, white: true },
  ];
  for (const job of jobs) {
    const b64 = readFileSync(join(ROOT, job.src)).toString('base64');
    const result = await page.evaluate(async ({ b64, height, white }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d');
      g.drawImage(bmp, 0, 0);
      const { data, width, height: h } = g.getImageData(0, 0, bmp.width, bmp.height);
      // trim to the artwork's visible bounds
      let x0 = width, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      const tw = x1 - x0 + 1, th = y1 - y0 + 1;
      const W = Math.round((tw * height) / th);
      const out = new OffscreenCanvas(W, height);
      const o = out.getContext('2d');
      o.imageSmoothingQuality = 'high';
      o.drawImage(bmp, x0, y0, tw, th, 0, 0, W, height);
      if (white) {
        // keep only the shape: white pixels, original alpha
        const img = o.getImageData(0, 0, W, height);
        for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; }
        o.putImageData(img, 0, 0);
      }
      const blob = await out.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), w: W, h: height };
    }, { b64, height: job.height, white: job.white });
    writeFileSync(join(OUT, job.out), Buffer.from(result.b64, 'base64'));
    console.log(JSON.stringify({ file: job.out, width: result.w, height: result.h, bytes: Buffer.from(result.b64, 'base64').length }));
  }
} finally {
  await browser.close();
}
