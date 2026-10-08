// Environment check for exports. Nothing needs installing; this reports what
// works and the one fix for what doesn't.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, findChrome } from './chrome.mjs';

const VENDOR = fileURLToPath(new URL('../../vendor/', import.meta.url));
const SKILL_MD = fileURLToPath(new URL('../../../SKILL.md', import.meta.url));

// the installed skill's version, so "am I up to date?" has a quick answer
function skillVersion() {
  try { return (/^\s*version:\s*"?([^"\s]+)"?/m.exec(readFileSync(SKILL_MD, 'utf8')) || [])[1] || 'unknown'; } catch { return 'unknown'; }
}

export async function doctor() {
  const node = Number(process.versions.node.split('.')[0]);
  const checks = { node: node >= 20 ? 'ok' : `node ${process.versions.node} (needs ≥ 20)`, render: 'ok (no dependencies)' };
  const fixes = [];
  if (node < 20) fixes.push('install Node.js 20 or newer');
  const vendored = ['gifenc.js', 'mp4-muxer.js', 'webm-muxer.js'].every((f) => existsSync(VENDOR + f));
  checks.encoders = vendored ? 'ok (bundled)' : 'missing bundled encoders: reinstall the skill';
  let webcodecs = false;
  const chrome = findChrome();
  const b = await launchBrowser();
  if (b.error) {
    checks.browser = b.error;
    fixes.push(b.fix);
  } else {
    checks.browser = chrome ? `ok (${chrome.split(/[/\\]/).pop()})` : `ok (${b.channel})`;
    try {
      const page = await b.browser.newPage({ viewport: { width: 400, height: 300 } });
      await page.goto(pathToFileURL(VENDOR).href);
      webcodecs = await page.evaluate(async () => {
        if (typeof VideoEncoder === 'undefined') return false;
        const s = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1280, height: 720 }).catch(() => ({}));
        return !!s.supported;
      });
    } catch {
      webcodecs = false;
    }
    await b.browser.close();
  }
  const ffmpeg = !spawnSync('ffmpeg', ['-version']).error;
  const browserOk = !b.error;
  checks.static = browserOk ? 'ok (png, jpeg, webp, svg)' : 'png, jpeg, webp unavailable (svg works without a browser)';
  checks.gif = browserOk && vendored ? 'ok' : 'unavailable';
  checks.mp4 = webcodecs ? 'ok (Chrome H.264)' : ffmpeg ? 'ok (ffmpeg)' : 'unavailable';
  if (browserOk && !webcodecs && !ffmpeg) fixes.push('for MP4 use Google Chrome (built-in H.264) or install ffmpeg');
  return { ok: fixes.length === 0, version: skillVersion(), checks, ...(fixes.length ? { fix: fixes } : {}) };
}
