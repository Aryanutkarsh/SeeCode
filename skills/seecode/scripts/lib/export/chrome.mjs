// Zero-dependency headless browser driver: launches the user's installed
// Chrome/Chromium/Edge with --remote-debugging-pipe and speaks the DevTools
// protocol over fds 3/4. Covers exactly what export needs: navigate, evaluate,
// inject CSS, resize, element screenshots. Falls back to Playwright if present.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

// how long export waits for web fonts and other subresources before it
// captures with fallback typography
export const loadCap = () => Number(process.env.SEECODE_LOAD_TIMEOUT_MS) || 15000;

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'],
  win32: [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};

export function findChrome() {
  if (process.env.SEECODE_CHROME && existsSync(process.env.SEECODE_CHROME)) return process.env.SEECODE_CHROME;
  for (const c of CANDIDATES[platform()] || []) {
    if (c.includes('/') || c.includes('\\')) {
      if (existsSync(c)) return c;
    } else {
      const r = spawnSync('which', [c], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
  }
  return null;
}

class Cdp {
  constructor(proc) {
    this.proc = proc;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    let buf = '';
    proc.stdio[4].on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\0')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i));
        buf = buf.slice(i + 1);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? `: ${msg.error.data}` : ''}`));
          else resolve(msg.result);
        } else if (msg.method) this.listeners.forEach((l) => l(msg));
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.proc.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, sessionId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.listeners.delete(l); reject(new Error(`timeout waiting for ${method}`)); }, timeout);
      const l = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) { clearTimeout(t); this.listeners.delete(l); resolve(msg.params); }
      };
      this.listeners.add(l);
    });
  }
}

class Page {
  constructor(cdp, sessionId, opts) {
    this.cdp = cdp;
    this.sid = sessionId;
    this.opts = opts;
    this.errors = [];
    cdp.listeners.add((m) => {
      if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] || 'page error');
    });
  }
  send(method, params) { return this.cdp.send(method, params, this.sid); }
  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.setViewportSize(this.opts.viewport);
    await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: this.opts.colorScheme || 'light' }] });
  }
  async setViewportSize({ width, height }) {
    this.viewport = { width, height };
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: this.opts.deviceScaleFactor || 1, mobile: false });
  }
  // change the pixel ratio in place (used to capture GIF frames at their final size)
  async setScale(dsf) {
    this.opts.deviceScaleFactor = dsf;
    await this.setViewportSize(this.viewport);
    return true;
  }
  // Resolves on the load event. If that takes more than `cap` ms (a proxy
  // holding the web-font stylesheet open blocks even DOMContentLoaded), the
  // page is reloaded with remote requests blocked so it finishes with fallback
  // fonts, and { stalled: true } lets the caller say so instead of hanging.
  async goto(url, { cap = loadCap() } = {}) {
    const load = async (timeout) => {
      const loaded = this.cdp.once('Page.loadEventFired', this.sid, timeout);
      loaded.catch(() => {});
      const r = await this.send('Page.navigate', { url });
      if (r.errorText) throw new Error(`navigation failed: ${r.errorText}`);
      return loaded;
    };
    const ok = await load(cap).then(() => true, () => false);
    if (ok) return { stalled: false };
    await this.send('Page.stopLoading').catch(() => {});
    await this.send('Network.enable');
    await this.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
    await load(30000);
    return { stalled: true };
  }
  // evaluate(fn, arg) like Playwright: fn is serialized, arg passed as JSON
  async evaluate(fn, arg) {
    const expression = typeof fn === 'function' ? `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})` : String(fn);
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text);
    return r.result.value;
  }
  addStyleTag({ content }) {
    return this.evaluate((css) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }, content);
  }
  async screenshot(selector, { type = 'png', quality } = {}) {
    const rect = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    }, selector);
    const r = await this.send('Page.captureScreenshot', {
      format: type,
      ...(type === 'jpeg' && quality ? { quality } : {}),
      clip: { x: rect.x, y: rect.y, width: Math.ceil(rect.width), height: Math.ceil(rect.height), scale: 1 },
      captureBeyondViewport: true,
    });
    return Buffer.from(r.data, 'base64');
  }
  close() { return this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {}); }
}

async function launchChrome(path) {
  const profile = mkdtempSync(join(tmpdir(), 'seecode-chrome-'));
  const proc = spawn(path, [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-background-networking',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const cdp = new Cdp(proc);
  const exited = new Promise((r) => proc.once('exit', r));
  await Promise.race([cdp.send('Browser.getVersion'), exited.then(() => { throw new Error('browser exited at startup'); })]);
  // never save files to the user's Downloads: SeeCode writes its own outputs,
  // and a page's in-page Export menu (exercised by tests) would otherwise land there
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  return {
    channel: path,
    async newPage(opts) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(cdp, sessionId, opts);
      page.targetId = targetId;
      await page.init();
      return page;
    },
    async close() {
      await cdp.send('Browser.close').catch(() => {});
      await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]);
      if (proc.exitCode === null) proc.kill('SIGKILL');
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

// Same surface over Playwright, used only when no system browser is found.
async function launchPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  return {
    channel: 'playwright-chromium',
    async newPage(opts) {
      const ctx = await browser.newContext({ viewport: opts.viewport, deviceScaleFactor: opts.deviceScaleFactor || 1, reducedMotion: 'no-preference', colorScheme: opts.colorScheme || 'light' });
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      return {
        errors,
        goto: async (url, { cap = loadCap() } = {}) => {
          try { await p.goto(url, { waitUntil: 'load', timeout: cap }); return { stalled: false }; }
          catch (e) {
            if (e?.name !== 'TimeoutError') throw e;
            await p.route(/^https?:/, (route) => route.abort());
            await p.goto(url, { waitUntil: 'load' });
            return { stalled: true };
          }
        },
        evaluate: (fn, arg) => p.evaluate(fn, arg),
        addStyleTag: (o) => p.addStyleTag(o),
        setViewportSize: (v) => p.setViewportSize(v),
        setScale: async () => false, // Playwright fixes the pixel ratio per context
        screenshot: (sel, o = {}) => p.locator(sel).screenshot({ type: o.type || 'png', ...(o.quality ? { quality: o.quality } : {}) }),
        close: () => ctx.close(),
      };
    },
    close: () => browser.close(),
  };
}

export async function launchBrowser() {
  const path = findChrome();
  if (path) {
    try {
      return { browser: await launchChrome(path), channel: path };
    } catch (e) {
      // fall through to Playwright
    }
  }
  try {
    const b = await launchPlaywright();
    return { browser: b, channel: b.channel };
  } catch {
    return { error: 'no Chrome/Chromium/Edge found', fix: 'install Google Chrome, or set SEECODE_CHROME=/path/to/chrome' };
  }
}
