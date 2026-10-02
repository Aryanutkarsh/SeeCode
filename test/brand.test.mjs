// Brand onboarding: palettes learned from a colour list, a project folder and
// a website (served locally), contrast fixes, dark mode, and rendering with a
// saved profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { learnBrand } from '../skills/seecode/scripts/lib/brand/brand.mjs';
import { contrast, luminance } from '../skills/seecode/scripts/lib/color.mjs';
import { skinCss } from '../skills/seecode/scripts/lib/tokens.mjs';

const SITE = fileURLToPath(new URL('./brand-fixtures/site/', import.meta.url));
// stand-in for the Google Fonts lookup, so tests never leave the machine
const GOOGLE = new Set(['Inter', 'Playfair Display', 'JetBrains Mono', 'DM Sans']);
const checkGoogle = async (f) => (GOOGLE.has(f) ? `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}&display=swap` : null);

function checkPalette(r) {
  for (const mode of ['light', 'dark']) {
    const p = r[mode];
    assert.ok(contrast(p.ink, p.paper) >= 4.5, `${mode} ink contrast`);
    if (p.accent) assert.ok(contrast(p.accent, p.paper) >= 3, `${mode} accent contrast`);
    assert.ok(contrast(p.link, p.paper) >= 3, `${mode} link contrast`);
  }
  // dark mode is never darker than #1a1a1a
  assert.ok(luminance(r.dark.paper) >= luminance('#1a1a1a') - 1e-9, 'dark paper not below #1a1a1a');
}

test('colour list: tan, off-white, charcoal', async () => {
  const r = await learnBrand(null, { colors: '#D4A574,#E7E5E2,#1E1C1A' });
  assert.equal(r.ok, true);
  assert.deepEqual([r.light.paper, r.light.ink], ['#e7e5e2', '#1e1c1a']);
  // the dark version keeps the brand exactly: charcoal paper, off-white text, tan accent
  assert.deepEqual([r.dark.paper, r.dark.ink, r.dark.accent], ['#1e1c1a', '#e7e5e2', '#d4a574']);
  // tan is too light on off-white, so the light accent is deepened and the receipt says why
  assert.notEqual(r.light.accent, '#d4a574');
  assert.ok(r.adjusted.some((a) => a.mode === 'light' && a.role === 'accent' && a.from === '#d4a574'));
  checkPalette(r);
});

test('pure black is lifted to #1a1a1a in dark mode', async () => {
  const r = await learnBrand(null, { colors: '#000000,#ffffff,#2f54eb' });
  assert.equal(r.dark.paper, '#1a1a1a');
  checkPalette(r);
});

test('project folder: CSS custom properties and selectors, with sources', async () => {
  const r = await learnBrand(SITE, { checkGoogle });
  assert.equal(r.ok, true);
  assert.equal(r.light.paper, '#faf7f2');
  assert.equal(r.light.ink, '#22201d');
  assert.equal(r.light.accent, '#e4572e');
  assert.equal(r.light.link, '#1b6fa8');
  assert.match(r.found.accent, /--color-primary/);
  checkPalette(r);
});

test('website: fetches the page and its stylesheets', async () => {
  const server = createServer((req, res) => {
    const path = req.url === '/' ? 'index.html' : req.url.slice(1);
    try {
      res.writeHead(200, { 'content-type': extname(path) === '.css' ? 'text/css' : 'text/html' });
      res.end(readFileSync(join(SITE, path)));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const r = await learnBrand(`http://127.0.0.1:${server.address().port}/`, { checkGoogle, fonts: 'Acme Sans' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.light.accent, '#e4572e');
    assert.ok(r.sources.some((s) => s.endsWith('/styles/main.css')));
    // a self-hosted face is kept with its file resolved to an absolute URL on the site
    assert.equal(r.fonts.sans.family, 'Acme Sans');
    assert.equal(r.fonts.sans.source, 'site');
    assert.match(r.fonts.faces, new RegExp(`url\\("http://127\\.0\\.0\\.1:${server.address().port}/fonts/acme-sans\\.woff2"\\)`));
    checkPalette(r);
  } finally {
    server.close();
  }
});

test('unreachable site and empty input fail with a fix', async () => {
  const r = await learnBrand('http://127.0.0.1:9/');
  assert.equal(r.ok, false);
  assert.ok(r.fix);
  assert.equal((await learnBrand(null, {})).ok, false);
});

test('a full brand palette becomes a full skin in both modes', async () => {
  const r = await learnBrand(null, { colors: '#D4A574,#E7E5E2,#1E1C1A' });
  const css = skinCss({ brand: { ...r.light, dark: r.dark } });
  const [light, dark] = [css.match(/^:root\{([^}]*)\}/)[1], css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1]];
  assert.match(light, /--sc-paper:#e7e5e2/);
  assert.match(light, /--sc-node:#/); // derived surfaces, not the default skin's
  assert.doesNotMatch(light, /--sc-paper-2:#eceae4/);
  assert.match(dark, /--sc-paper:#1e1c1a/);
  assert.match(dark, /--sc-accent:#d4a574/);
});

test('saved profile is used when rendering', async () => {
  const home = mkdtempSync(join(tmpdir(), 'sc-brand-'));
  process.env.SEECODE_HOME = home;
  const config = await import('../skills/seecode/scripts/lib/config/config.mjs');
  const r = await learnBrand(null, { colors: '#D4A574,#E7E5E2,#1E1C1A' });
  const saved = config.saveProfile('tan', r.light, { dark: r.dark, source: 'colour list' });
  assert.equal(saved.dark.paper, '#1e1c1a');
  const { renderSpec } = await import('../skills/seecode/scripts/lib/render.mjs');
  const profile = config.loadProfile('tan');
  const html = renderSpec({ type: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }] }, { settings: { brand: { ...profile.brand, dark: profile.dark } } }).html;
  assert.match(html, /--sc-paper:#e7e5e2/);
  assert.match(html, /:root\[data-theme="dark"\]\{--sc-paper:#1e1c1a/);
  delete process.env.SEECODE_HOME;
});

test('typefaces: body, headings and code fonts with where they load from', async () => {
  const r = await learnBrand(SITE, { checkGoogle });
  assert.deepEqual([r.fonts.sans.family, r.fonts.serif.family, r.fonts.mono.family], ['Inter', 'Playfair Display', 'JetBrains Mono']);
  assert.ok([r.fonts.sans, r.fonts.serif, r.fonts.mono].every((f) => f.source === 'google'));
  assert.equal(r.fonts.href.length, 3);
  assert.match(r.fonts.serif.from, /h1, h2/);
  // --fonts names typefaces directly; unknown ones are kept as installed-only
  const named = await learnBrand(null, { colors: '#D4A574,#E7E5E2,#1E1C1A', fonts: 'sans=DM Sans,serif=Made Up Serif', checkGoogle });
  assert.equal(named.fonts.sans.source, 'google');
  assert.equal(named.fonts.serif.source, 'system');
  assert.ok(named.fonts.serif.note);
});

test('next/font generated names resolve to the real family', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-nextfont-'));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(dir, 'app.css'), "body{background:#fff;color:#111;font-family:'__Inter_d65c78', '__Inter_Fallback_d65c78'}a{color:#2563eb}");
  const r = await learnBrand(dir, { checkGoogle });
  assert.equal(r.fonts.sans.family, 'Inter');
});

test('font data is sanitised before it reaches a page', async () => {
  const { cleanFonts } = await import('../skills/seecode/scripts/lib/config/config.mjs');
  const f = cleanFonts({
    sans: { family: "Evil'</style><script>x()</script>" },
    href: ['https://fonts.googleapis.com/css2?family=Inter&display=swap', 'https://evil.example/x.css', 'javascript:alert(1)'],
    faces: '@font-face{font-family:A;src:url("https://ok.example/a.woff2")}@font-face{font-family:B;src:url("http://plain.example/b.woff2")}</style><script>',
  });
  assert.doesNotMatch(f.sans.family, /[<>'"]/);
  assert.deepEqual(f.href, ['https://fonts.googleapis.com/css2?family=Inter&display=swap']);
  assert.match(f.faces, /ok\.example/);
  assert.doesNotMatch(f.faces, /plain\.example|<script/);
});

test('brand fonts lead the stacks and load in the page', async () => {
  const { renderSpec } = await import('../skills/seecode/scripts/lib/render.mjs');
  const html = renderSpec({ type: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }] }, { settings: { brand: { fonts: { sans: { family: 'Inter' }, href: ['https://fonts.googleapis.com/css2?family=Inter&display=swap'] } } } }).html;
  assert.match(html, /--sc-font-sans:'Inter', 'IBM Plex Sans'/);
  assert.match(html, /<link class="sc-brand-fonts" rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter&amp;display=swap">/);
  // the default stack is untouched without a brand
  const plain = renderSpec({ type: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }] }).html;
  assert.match(plain, /--sc-font-sans:'IBM Plex Sans'/);
  assert.doesNotMatch(plain, /<link class="sc-brand-fonts"/);
});
