// Export a SeeCode HTML diagram to static (png, jpeg, webp, svg) and animated
// (gif, mp4, webm) formats. Static = the settled end frame. Animated = the
// page's own CSS animations, paused and stepped frame by frame (deterministic),
// then encoded in a browser page (gifenc / WebCodecs + mp4/webm muxers).
// System ffmpeg is used for mp4 only when WebCodecs H.264 is unavailable.
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, basename, extname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { status as configStatus } from '../config/config.mjs';
import { launchBrowser } from './chrome.mjs';
import { exportSvg } from './svg.mjs';

const VENDOR = fileURLToPath(new URL('../../vendor/', import.meta.url));
const STATIC = new Set(['png', 'jpeg', 'jpg', 'webp', 'svg']);
const ANIMATED = new Set(['gif', 'mp4', 'webm']);

export { launchBrowser };

// Bundled encoder libraries (MIT, see scripts/vendor/LICENSES.md), injected into the page.
function libSource(file, wrapCjs) {
  const src = readFileSync(join(VENDOR, file), 'utf8');
  return wrapCjs ? `(function(){var exports={};var module={exports};${src};window.${wrapCjs}=module.exports&&Object.keys(module.exports).length?module.exports:exports;})();` : src;
}

// Destination presets (`--for`): the right formats, quality and crop for where
// the diagram will live. Explicit --formats/--scale/--crop/--theme still win.
// Docs-like targets get vector SVG first (crisp at any zoom) plus a hi-res PNG
// fallback for tools that refuse SVG; their own page supplies the heading, so
// the capture is the diagram only.
export const DESTINATIONS = {
  pdf: { formats: 'svg,png', scale: 3, crop: 'diagram' },
  print: { formats: 'svg,png', scale: 3, crop: 'diagram' },
  docs: { formats: 'svg,png', scale: 2, crop: 'diagram' },
  word: { formats: 'svg,png', scale: 3, crop: 'diagram' },
  gdocs: { formats: 'png', scale: 3, crop: 'diagram' },
  notion: { formats: 'svg,png', scale: 2, crop: 'diagram' },
  confluence: { formats: 'svg,png', scale: 2, crop: 'diagram' },
  readme: { formats: 'svg,png', scale: 2, crop: 'diagram' },
  slides: { formats: 'svg,png', scale: 2, crop: 'diagram' },
  gslides: { formats: 'png', scale: 3, crop: 'diagram' },
  figma: { formats: 'svg', crop: 'diagram' },
  social: { formats: 'png', scale: 2, crop: 'figure' },
  video: { formats: 'mp4,gif', scale: 2, crop: 'figure' },
  animated: { formats: 'gif', scale: 2, crop: 'diagram' },
};

export async function exportDiagram(htmlPath, rawFlags = {}) {
  const preset = rawFlags.for ? DESTINATIONS[String(rawFlags.for).toLowerCase()] : null;
  if (rawFlags.for && !preset) return { ok: false, error: `unknown destination "${rawFlags.for}"`, fix: `use one of: ${Object.keys(DESTINATIONS).join(', ')}` };
  const flags = { ...(preset || {}), ...Object.fromEntries(Object.entries(rawFlags).filter(([k]) => k !== 'for')) };
  if (!existsSync(htmlPath)) return { ok: false, error: `not found: ${htmlPath}` };
  const settings = configStatus(dirname(htmlPath)).settings;
  const requested = String(flags.formats || settings.exportFormats.join(','))
    .split(',').map((s) => s.trim().toLowerCase()).filter((f) => f && f !== 'html');
  const formats = requested.map((f) => (f === 'jpg' ? 'jpeg' : f));
  const unknown = formats.filter((f) => !STATIC.has(f) && !ANIMATED.has(f));
  if (unknown.length) return { ok: false, error: `unknown format(s): ${unknown.join(', ')}`, fix: 'use png, jpeg, webp, svg, gif, mp4, webm' };
  if (!formats.length) return { ok: true, files: [], note: 'nothing to export (html only)' };

  // scale is a target, not a fixed value: the page's exportPlan sizes every
  // format from the content (smallest text, diagram size, format budgets)
  const want = flags.scale || settings.scale;
  const scale = want && want !== 'auto' ? Number(want) : undefined;
  const fps = Math.min(60, Number(flags.fps || settings.fps || 30));
  const theme = flags.theme || (settings.skin === 'dark' ? 'dark' : 'light');
  const crop = flags.crop || 'figure'; // figure (title + diagram) | diagram
  const stem = join(dirname(htmlPath), basename(htmlPath, extname(htmlPath)));

  const files = [];
  const warnings = [];
  // SVG needs no browser: it is assembled from the HTML in Node (works in sandboxes)
  if (formats.includes('svg')) {
    const out = `${stem}.svg`;
    const r = await exportSvg(readFileSync(htmlPath, 'utf8'), { theme });
    if (r.warning) warnings.push(`svg: ${r.warning}`);
    writeFileSync(out, r.svg);
    files.push({ format: 'svg', path: out, bytes: readFileSync(out).length });
  }
  const rest = formats.filter((f) => f !== 'svg');
  if (!rest.length) return { ok: true, files, ...(warnings.length ? { warnings } : {}) };
  const launched = await launchBrowser();
  if (launched.error) {
    return { ok: files.length > 0, files, error: `${rest.join(', ')}: ${launched.error}`, fix: `${launched.fix}, or open the HTML and use its Export menu (PNG, JPEG, SVG, GIF, MP4 run in the browser)` };
  }
  const { browser } = launched;
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: scale || 2, colorScheme: theme });
    const errors = page.errors;
    await page.goto(`${pathToFileURL(htmlPath).href}?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.sc-bar,.sc-status,.sc-evidence{display:none!important}body{padding:0!important;min-height:0!important;display:block!important}.sc-page{padding:36px 40px 32px;max-width:none!important;background:var(--sc-paper)}.sc-svg{max-height:none!important}' });
    // lay the diagram out 1:1 (one viewBox unit = one CSS px, so font sizes are
    // true sizes); the pixel ratio then comes from the content-aware plan
    const pageW = await page.evaluate(() => {
      const svg = document.querySelector('.sc-svg');
      const vb = svg.viewBox.baseVal;
      svg.style.width = `${vb.width}px`;
      svg.style.maxWidth = 'none';
      const w = Math.round(Math.max(640, vb.width));
      document.querySelector('.sc-page').style.width = `${w + 80}px`;
      return w + 80;
    });
    await page.setViewportSize({ width: pageW, height: 900 });
    const target = crop === 'diagram' ? '.sc-stage' : '.sc-page';
    const box = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { w: r.width, h: r.height }; }, target);
    const planFor = (fmt) => page.evaluate(([f, o]) => window.SeeCode.exportPlan(f, o), [fmt, { ...box, ...(scale ? { scale } : {}) }]);
    let fixedScale = false;
    const useScale = async (k) => { if (!(await page.setScale(k))) fixedScale = true; };
    const noted = new Set();
    const note = (p) => { if (p.warn && !noted.has(p.warn)) { noted.add(p.warn); warnings.push(p.warn); } };

    // ---- static: settled end frame
    await page.evaluate(() => window.SeeCode && window.SeeCode.setLive(false));
    for (const f of formats.filter((x) => STATIC.has(x))) {
      const out = `${stem}.${f === 'jpeg' ? 'jpg' : f}`;
      if (f === 'svg') continue; // already written without a browser
      const sp = await planFor(f);
      note(sp);
      await useScale(sp.scale);
      if (f === 'webp') {
        const png = await page.screenshot(target, { type: 'png' });
        const webp = await page.evaluate(async (b64) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          c.getContext('2d').drawImage(bmp, 0, 0);
          const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.92 });
          const buf = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          return btoa(s);
        }, png.toString('base64'));
        writeFileSync(out, Buffer.from(webp, 'base64'));
      } else {
        writeFileSync(out, await page.screenshot(target, { type: f, ...(f === 'jpeg' ? { quality: 92 } : {}) }));
      }
      files.push({ format: f, path: out, bytes: readFileSync(out).length, width: sp.width, height: sp.height, scale: sp.scale });
    }

    // ---- animated: step the page's own animations
    const animFormats = formats.filter((x) => ANIMATED.has(x));
    if (animFormats.length) {
      const hasMotion = await page.evaluate(() => document.querySelector('.sc-svg').hasAttribute('data-sc-motion'));
      if (!hasMotion) warnings.push('diagram has motion:none; animated exports will be a still frame');
      const plan = await page.evaluate((durFlag) => {
        const svg = document.querySelector('.sc-svg');
        window.SeeCode.setLive(true);
        window.SeeCode.replay();
        const anims = document.getAnimations();
        anims.forEach((a) => a.pause());
        const cs = getComputedStyle(svg);
        const settle = parseFloat(cs.getPropertyValue('--sc-settle')) || 0;
        let finite = 0;
        let loop = 0;
        for (const a of anims) {
          const t = a.effect.getComputedTiming();
          if (t.iterations === Infinity) loop = Math.max(loop, (t.delay || 0) + (t.duration || 0));
          else finite = Math.max(finite, t.endTime || 0);
        }
        const auto = Math.max(finite, settle) + (loop ? Math.max(0, loop - Math.max(finite, settle)) : 0) + 900;
        const total = durFlag && durFlag !== 'auto' ? Number(durFlag) * 1000 : Math.min(14000, auto || 1500);
        window.__scAnims = anims;
        return { total, count: anims.length };
      }, String(flags.duration || settings.duration || 'auto'));
      // Step the animations and screenshot each frame at a given pixel ratio.
      const capture = async (rate) => {
        const shots = [];
        const count = Math.max(1, Math.round((plan.total / 1000) * rate));
        for (let i = 0; i < count; i++) {
          await page.evaluate((tt) => window.__scAnims.forEach((a) => { a.currentTime = tt; }), (i * 1000) / rate);
          shots.push((await page.screenshot(target, { type: 'png' })).toString('base64'));
        }
        return shots;
      };
      const load = async (name, shots) => {
        await page.evaluate((n) => { window[n] = []; }, name);
        for (const f of shots) await page.evaluate(async ([n, b64]) => {
          const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
          window[n].push(await createImageBitmap(blob));
        }, [name, f]);
      };
      // encode inside the diagram's own file:// page (a secure context, so WebCodecs is available)
      await page.evaluate(`${libSource('gifenc.js', 'gifenc')};${libSource('mp4-muxer.js')};window.Mp4Muxer=Mp4Muxer;${libSource('webm-muxer.js')};window.WebMMuxer=WebMMuxer;true`);
      // every animated format is captured at its planned pixel ratio, so frames
      // arrive at their final size with no resampling (resampling blurs text)
      const video = animFormats.filter((f) => f !== 'gif');
      let videoFrames = [];
      let vplan = null;
      if (video.length) {
        vplan = await planFor(video[0]);
        note(vplan);
        await useScale(vplan.scale);
        videoFrames = await capture(fps);
        await load('__vframes', videoFrames);
      }
      let gplan = null;
      let gifW = 0;
      let gifFps = 15;
      if (animFormats.includes('gif')) {
        const gw = flags['gif-width'] ? Number(flags['gif-width']) : 0;
        gplan = await planFor('gif');
        if (gw) gplan = await page.evaluate(([o, k]) => window.SeeCode.exportPlan('gif', { ...o, scale: k }), [box, gw / box.w]);
        note(gplan);
        gifFps = Math.min(fps, gplan.fps);
        gifW = gplan.width;
        await useScale(gplan.scale);
        await load('__gframes', await capture(gifFps));
      }
      if (fixedScale) warnings.push('resampled: the Playwright fallback cannot change the pixel ratio');
      for (const fmt of animFormats) {
        const out = `${stem}.${fmt}`;
        const opts = { fmt, fps: fmt === 'gif' ? gifFps : fps, gifW };
        let res = await page.evaluate(encodeInPage, opts);
        if (res.error && fmt === 'mp4') {
          const ff = ffmpegEncode(videoFrames, fps, out);
          if (ff.ok) res = { bytes: null };
          else { warnings.push(`mp4: ${res.error}; ${ff.error}`); continue; }
        } else if (res.error) { warnings.push(`${fmt}: ${res.error}`); continue; }
        if (res.b64) writeFileSync(out, Buffer.from(res.b64, 'base64'));
        const p = fmt === 'gif' ? gplan : vplan;
        files.push({ format: fmt, path: out, bytes: readFileSync(out).length, width: p.width, height: p.height, scale: p.scale, frames: res.frames, ...(fmt === 'gif' ? { fps: gifFps } : {}), seconds: Math.round(plan.total / 100) / 10 });
      }
    }
    if (errors.length) warnings.push(`page errors: ${errors.slice(0, 2).join(' | ')}`);
    await page.close();
  } finally {
    await browser.close();
  }
  return { ok: files.length > 0, files: files.map((f) => ({ ...f, path: f.path })), ...(warnings.length ? { warnings } : {}) };
}

// Runs inside the encoder page. window.__frames holds ImageBitmaps.
async function encodeInPage({ fmt, fps, gifW }) {
  const frames = fmt === 'gif' ? window.__gframes : window.__vframes;
  const toB64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const W0 = frames[0].width, H0 = frames[0].height;
  if (fmt === 'gif') {
    const { GIFEncoder, quantize, applyPalette } = window.gifenc;
    // frames already arrive at the GIF's width; resample only if a fallback couldn't
    const k = gifW && W0 > gifW + 2 ? gifW / W0 : 1;
    const w = Math.round(W0 * k), h = Math.round(H0 * k);
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    const pick = frames;
    // one global palette from the last (complete) frame keeps colors stable;
    // index 255 is reserved as "unchanged since previous frame" (transparent)
    g.drawImage(pick[pick.length - 1], 0, 0, w, h);
    const palette = quantize(g.getImageData(0, 0, w, h).data, 255);
    while (palette.length < 255) palette.push([0, 0, 0]);
    palette.push([255, 0, 255]);
    const T = 255;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    let prev = null;
    pick.forEach((bmp, i) => {
      g.drawImage(bmp, 0, 0, w, h);
      const idx = applyPalette(g.getImageData(0, 0, w, h).data, palette.slice(0, 255));
      let out = idx;
      if (prev) {
        out = new Uint8Array(idx.length);
        for (let p = 0; p < idx.length; p++) out[p] = idx[p] === prev[p] ? T : idx[p];
      }
      gif.writeFrame(out, w, h, {
        palette: i === 0 ? palette : undefined,
        delay: i === pick.length - 1 ? delay + 1500 : delay,
        repeat: 0,
        transparent: i > 0,
        transparentIndex: T,
        dispose: 1,
      });
      prev = idx;
    });
    gif.finish();
    return { b64: toB64(gif.bytes()), frames: pick.length };
  }
  if (typeof VideoEncoder === 'undefined') return { error: 'WebCodecs unavailable in this browser' };
  const w = W0 - (W0 % 2), h = H0 - (H0 % 2);
  const isMp4 = fmt === 'mp4';
  const candidates = isMp4 ? ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01f'] : ['vp09.00.40.08', 'vp8'];
  let codec = null;
  for (const c of candidates) {
    const s = await VideoEncoder.isConfigSupported({ codec: c, width: w, height: h, bitrate: 6e6, framerate: fps, ...(isMp4 ? { avc: { format: 'avc' } } : {}) }).catch(() => ({ supported: false }));
    if (s.supported) { codec = c; break; }
  }
  if (!codec) return { error: `no ${isMp4 ? 'H.264' : 'VP9/VP8'} encoder for ${w}×${h}` };
  const target = isMp4 ? new Mp4Muxer.ArrayBufferTarget() : new WebMMuxer.ArrayBufferTarget();
  const muxer = isMp4
    ? new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' })
    : new WebMMuxer.Muxer({ target, video: { codec: codec.startsWith('vp09') ? 'V_VP9' : 'V_VP8', width: w, height: h, frameRate: fps } });
  let failure = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  encoder.configure({ codec, width: w, height: h, bitrate: Math.min(12e6, w * h * fps * 0.12), framerate: fps, ...(isMp4 ? { avc: { format: 'avc' } } : {}) });
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d');
  const hold = Math.round(fps * 1.2);
  const seq = frames.concat(Array(hold).fill(frames[frames.length - 1]));
  for (let i = 0; i < seq.length; i++) {
    g.drawImage(seq[i], 0, 0);
    const vf = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
  }
  await encoder.flush();
  if (failure) return { error: String(failure) };
  muxer.finalize();
  return { b64: toB64(new Uint8Array(target.buffer)), frames: seq.length };
}

function ffmpegEncode(framesB64, fps, out) {
  const probe = spawnSync('ffmpeg', ['-version']);
  if (probe.error) return { ok: false, error: 'ffmpeg not found (brew install ffmpeg)' };
  const dir = mkdtempSync(join(tmpdir(), 'seecode-'));
  try {
    framesB64.forEach((b, i) => writeFileSync(join(dir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(b, 'base64')));
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    return r.status === 0 ? { ok: true } : { ok: false, error: String(r.stderr).slice(0, 200) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
