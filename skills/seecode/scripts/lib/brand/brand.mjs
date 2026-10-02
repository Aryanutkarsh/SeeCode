// `seecode brand`: learn a brand palette from a website, a project folder or a
// plain list of colours, map it to SeeCode's roles (paper, ink, accent, link),
// build matching light and dark versions, fix contrast, and explain every
// choice in a receipt. Page content is parsed as text only: nothing is executed.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';
import { parse, norm, toHsl, luminance, contrast, isDark, mix, ensureContrast, TARGETS } from '../color.mjs';

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const DEFAULT = { lightPaper: '#f6f5f1', lightInk: '#1d2433', darkPaper: '#1a1a1a', darkInk: '#e8e6e3', link: '#0f7f81', darkLink: '#3cc6c4' };
const MAX_BYTES = 2_000_000;
const FETCH_MS = 10_000;

// ---- collecting sources ----------------------------------------------------

async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (SeeCode brand onboarding)', accept: 'text/html,text/css,*/*' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    return text.slice(0, MAX_BYTES);
  } finally {
    clearTimeout(t);
  }
}

async function fromUrl(url) {
  const html = await get(url);
  const docs = [{ from: url, kind: 'html', text: html }];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) docs.push({ from: `${url} <style>`, kind: 'css', text: m[1] });
  const theme = /<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']theme-color["']/i.exec(html);
  const sheets = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel=["'][^"']*stylesheet/i.test(tag))
    .map((tag) => (/href=["']([^"']+)["']/i.exec(tag) || [])[1])
    .filter(Boolean)
    .filter((h) => !/fonts\.googleapis|use\.typekit|fontawesome/i.test(h))
    .slice(0, 6);
  for (const href of sheets) {
    const abs = new URL(href.replace(/&amp;/g, '&'), url).href;
    if (!/^https?:/.test(abs)) continue;
    try { docs.push({ from: abs, kind: 'css', text: await get(abs) }); } catch { /* unreachable sheet: skip */ }
  }
  return { docs, themeColor: theme && norm(theme[1]) };
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', 'vendor', '.seecode', 'diagrams']);
const WANT = /\.(css|scss|sass|less|html?)$|(^|\/)(tailwind\.config|theme|tokens|colors|design-tokens)[^/]*\.(js|cjs|mjs|ts|json)$/i;

function fromPath(path) {
  const docs = [];
  const visit = (p, depth) => {
    if (docs.length >= 60) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      if (depth > 5 || SKIP_DIRS.has(basename(p))) return;
      for (const f of readdirSync(p).sort()) visit(join(p, f), depth + 1);
    } else if (WANT.test(p) && st.size < 400_000) {
      docs.push({ from: relative(process.cwd(), p) || p, kind: /\.(js|cjs|mjs|ts|json)$/.test(p) ? 'tokens' : /\.html?$/.test(p) ? 'html' : 'css', text: readFileSync(p, 'utf8') });
    }
  };
  visit(path, 0);
  return { docs, themeColor: null };
}

// ---- reading colours out of CSS, token files and HTML -----------------------

function scan(docs) {
  const props = new Map(); // --name → {value, from}
  const decls = []; // {sel, prop, color, from}
  const freq = new Map(); // colour → count
  const fonts = []; // {sel, value, from}
  const fontProps = new Map(); // --font-* → raw stack
  const faces = []; // {family, css, base}
  const count = (c) => freq.set(c, (freq.get(c) || 0) + 1);
  for (const d of docs) {
    let css = d.text;
    if (d.kind === 'html') css = [...d.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    if (d.kind === 'tokens') {
      // tailwind / theme files: `primary: '#…'`, `"brand-500": "#…"`, nested keys flattened by name
      for (const m of d.text.matchAll(/["']?([A-Za-z][\w-]*)["']?\s*:\s*["'](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))["']/g)) {
        const c = norm(m[2]);
        if (!c) continue;
        props.set(`--${m[1].toLowerCase()}`, { value: c, from: d.from });
        count(c);
      }
      continue;
    }
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = rule[1].trim().replace(/\s+/g, ' ');
      if (/@font-face$/i.test(sel)) {
        const fam = /font-family\s*:\s*([^;]+)/i.exec(rule[2]);
        if (fam) faces.push({ family: unquote(fam[1]), css: `@font-face{${rule[2].trim()}}`, base: d.from });
        continue;
      }
      for (const decl of rule[2].split(';')) {
        const i = decl.indexOf(':');
        if (i < 0) continue;
        const prop = decl.slice(0, i).trim().toLowerCase();
        const value = decl.slice(i + 1).trim();
        if (prop.startsWith('--font')) fontProps.set(prop, value);
        if (prop.startsWith('--')) {
          const c = norm(value) || norm((value.match(COLOR_RE) || [])[0]);
          if (c && !/^[\d.]+$/.test(value)) props.set(prop, { value: c, from: d.from, raw: value });
          else if (/^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(value)) { // shadcn style: "222 47% 11%"
            const [h, s, l] = value.split(/\s+/).map(parseFloat);
            const hc = norm(`hsl(${h}, ${s}%, ${l}%)`);
            if (hc) props.set(prop, { value: hc, from: d.from, raw: value });
          }
          continue;
        }
        if (prop === 'font-family' || prop === 'font') fonts.push({ sel, value: prop === 'font' ? value.replace(/^.*?\d[\w.%]*(?:\/[\w.%]+)?\s+/, '') : value, from: d.from });
        if (!/color|background|fill|stroke|border/.test(prop)) continue;
        const v = value.replace(/var\((--[\w-]+)[^)]*\)/g, (_, n) => (props.get(n.toLowerCase()) || {}).value || '');
        for (const raw of v.match(COLOR_RE) || []) {
          const p = parse(raw);
          if (!p || p.a < 0.6) continue;
          const c = norm(raw);
          decls.push({ sel, prop, color: c, from: d.from });
          count(c);
        }
      }
    }
  }
  for (const { value } of props.values()) count(value);
  return { props, decls, freq, fonts, fontProps, faces };
}

// ---- deciding roles --------------------------------------------------------

const ROLE_NAMES = {
  paper: /^--(?:color-)?(?:bg|background|paper|surface|canvas|base|page)(?:-(?:color|default|primary|base|1|100))?$/,
  ink: /^--(?:color-)?(?:text|foreground|fg|ink|body|body-color|copy)(?:-(?:color|default|primary|base|1|900))?$/,
  accent: /^--(?:color-)?(?:primary|brand|accent|cta|highlight)(?:-(?:color|default|base|main|500|600))?$/,
  link: /^--(?:color-)?(?:link|secondary)(?:-(?:color|default|base|500))?$/,
};

function byName(props, role) {
  for (const [name, v] of props) if (ROLE_NAMES[role].test(name)) return { value: v.value, from: `${name} in ${v.from}` };
  return null;
}

function bySelector(decls, sel, props) {
  const hit = decls.find((d) => sel.test(d.sel) && props.test(d.prop));
  return hit ? { value: hit.color, from: `${hit.sel} { ${hit.prop} } in ${hit.from}` } : null;
}

const saturated = (c) => { const h = toHsl(parse(c)); return h.s > 0.28 && h.l > 0.12 && h.l < 0.88; };
const hueGap = (a, b) => { const d = Math.abs(toHsl(parse(a)).h - toHsl(parse(b)).h) % 360; return Math.min(d, 360 - d); };

function decide({ props, decls, freq }, themeColor, listed) {
  const evidence = {};
  const pick = (role, ...tries) => { for (const t of tries) if (t && t.value) { evidence[role] = t; return t.value; } return null; };
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const neutrals = (listed || ranked).filter((c) => !saturated(c));
  const lightest = [...neutrals].sort((a, b) => luminance(b) - luminance(a))[0];
  const darkest = [...neutrals].sort((a, b) => luminance(a) - luminance(b))[0];
  const paper = pick('paper',
    !listed && bySelector(decls, /^(html|body|:root)$/, /^background(-color)?$/),
    !listed && byName(props, 'paper'),
    listed && lightest && { value: lightest, from: 'lightest colour in the list' });
  const ink = pick('ink',
    !listed && bySelector(decls, /^(html|body|:root)$/, /^color$/),
    !listed && byName(props, 'ink'),
    listed && darkest && { value: darkest, from: 'darkest colour in the list' });
  const accent = pick('accent',
    !listed && byName(props, 'accent'),
    !listed && bySelector(decls, /(^|[\s,.])(button|\.btn|\.button)|primary|cta/i, /^background(-color)?$/),
    !listed && themeColor && saturated(themeColor) && { value: themeColor, from: '<meta name="theme-color">' },
    (() => { const c = (listed || ranked).find(saturated); return c && { value: c, from: listed ? 'most saturated colour in the list' : 'most used saturated colour' }; })());
  const link = pick('link',
    !listed && (() => { const a = bySelector(decls, /^a(:link)?$/, /^color$/); return a && saturated(a.value) && (!accent || hueGap(a.value, accent) > 25) ? a : null; })(),
    !listed && byName(props, 'link'),
    (() => { const c = (listed || ranked).find((x) => saturated(x) && x !== accent && (!accent || hueGap(x, accent) > 25)); return c && { value: c, from: listed ? 'second accent colour in the list' : 'second most used saturated colour' }; })());
  return { paper, ink, accent, link, lightest, darkest, evidence };
}

// ---- typefaces ---------------------------------------------------------------

const unquote = (s) => String(s).trim().replace(/^['"]|['"]$/g, '').trim();
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|unset|revert|math|emoji|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji)$/i;
const SYSTEM = /^(segoe ui|helvetica neue|helvetica|arial|georgia|times new roman|times|menlo|monaco|consolas|courier new|courier|sf pro( text| display)?|sf mono|verdana|tahoma|trebuchet ms)$/i;

// First real family in a font stack; resolves var(--x), and next/font's
// generated names (`__Inter_d65c78`) back to the family they wrap.
function familyOf(stack, fontProps, depth = 0) {
  if (!stack) return null;
  const v = String(stack).replace(/var\((--[\w-]+)[^)]*\)/g, (_, n) => (depth < 3 && fontProps.get(n.toLowerCase())) || '');
  for (const part of v.split(',')) {
    let f = unquote(part);
    if (!f || /var\(/.test(f)) continue;
    const nx = /^__([A-Za-z0-9]+(?:_[A-Za-z][a-z]+)*?)_(?:Fallback_)?[0-9a-f]{5,}$/.exec(f);
    if (nx) { if (/Fallback/.test(f)) continue; f = nx[1].replace(/_/g, ' '); }
    if (GENERIC.test(f)) continue;
    return f.replace(/["'<>;{}\\]/g, '').slice(0, 60);
  }
  return null;
}

const FONT_ROLES = {
  sans: { sel: /^(html|body|:root)$/, prop: /^--font-(sans|body|base|text|primary|default)$/ },
  serif: { sel: /^(h1|h2|h1, ?h2.*|\.h1|\.title|\.heading|\.display)$/, prop: /^--font-(heading|headings|display|serif|title|header)$/ },
  mono: { sel: /^(code|pre|kbd|samp|code, ?pre.*|pre, ?code.*)$/, prop: /^--font-(mono|code|monospace)$/ },
};

function decideFonts({ fonts, fontProps }) {
  const out = {};
  for (const [role, r] of Object.entries(FONT_ROLES)) {
    const d = fonts.find((f) => r.sel.test(f.sel) && familyOf(f.value, fontProps));
    if (d) { out[role] = { family: familyOf(d.value, fontProps), from: `${d.sel} { font-family } in ${d.from}` }; continue; }
    for (const [name, value] of fontProps) {
      if (r.prop.test(name) && familyOf(value, fontProps)) { out[role] = { family: familyOf(value, fontProps), from: name }; break; }
    }
  }
  // headings in the body font add nothing: keep SeeCode's title serif
  if (out.serif && out.sans && out.serif.family.toLowerCase() === out.sans.family.toLowerCase()) delete out.serif;
  return out;
}

const AXES = { sans: 'wght@400;500;600;700', serif: 'wght@400;500', mono: 'wght@400;500;600' };

export async function googleHas(family, axes) {
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`;
  for (const url of [`${base}:${axes}&display=swap`, `${base}&display=swap`]) {
    try {
      const css = await get(url);
      if (/@font-face/.test(css)) return url;
    } catch { /* not on Google Fonts with these axes */ }
  }
  return null;
}

// Where each font can load from: Google Fonts, the site's own @font-face
// files (absolute URLs), or only where it's installed (system).
async function sourceFonts(roles, faces, { checkGoogle = googleHas } = {}) {
  const hrefs = [];
  let faceCss = '';
  for (const [role, f] of Object.entries(roles)) {
    const own = faces.filter((x) => x.family.toLowerCase() === f.family.toLowerCase());
    if (own.length && own.every((x) => /^https?:/.test(x.base))) {
      f.source = 'site';
      faceCss += own.map((x) => x.css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (_, u) => `url("${new URL(u, x.base).href}")`)).join('');
      continue;
    }
    if (SYSTEM.test(f.family)) { f.source = 'system'; continue; }
    const href = await checkGoogle(f.family, AXES[role]);
    if (href) { f.source = 'google'; hrefs.push(href); continue; }
    f.source = own.length ? 'project files (not loadable from diagrams)' : 'system';
    f.note = 'shows only where this font is installed; elsewhere SeeCode falls back to its own';
  }
  return { hrefs: [...new Set(hrefs)], faces: faceCss.slice(0, 20000) };
}

// ---- light and dark palettes ------------------------------------------------

function build(found) {
  const { paper, ink, accent, link, lightest, darkest } = found;
  const adjusted = [];
  const lightPaper = [paper, ink, lightest].find((c) => c && !isDark(c) && luminance(c) > 0.6) || DEFAULT.lightPaper;
  const darkSource = [paper, ink, darkest].find((c) => c && isDark(c));
  // dark mode never uses pure black: anything darker than #1a1a1a is lifted to it
  let darkPaper = darkSource || DEFAULT.darkPaper;
  if (luminance(darkPaper) < luminance(DEFAULT.darkPaper)) darkPaper = DEFAULT.darkPaper;
  if (luminance(darkPaper) > 0.06) darkPaper = mix(darkPaper, DEFAULT.darkPaper, 0.6);
  const lightInkWant = [ink, paper, darkest].find((c) => c && isDark(c)) || DEFAULT.lightInk;
  // dark-mode text is the brand's own light surface, so it stays warm or cool like the brand
  const darkInkWant = [paper, ink, lightest].find((c) => c && !isDark(c)) || DEFAULT.darkInk;
  const fit = (mode, role, want, bg) => {
    const got = ensureContrast(want, bg, TARGETS[role]);
    if (got !== norm(want)) adjusted.push({ mode, role, from: norm(want), to: got, why: `${contrast(want, bg).toFixed(2)}:1 against the ${mode} background; ${role === 'ink' ? 'body text needs 4.5:1' : 'accent text and marks need 3:1'}` });
    return got;
  };
  const light = { paper: lightPaper, ink: fit('light', 'ink', lightInkWant, lightPaper) };
  const dark = { paper: darkPaper, ink: fit('dark', 'ink', darkInkWant, darkPaper) };
  if (accent) { light.accent = fit('light', 'accent', accent, light.paper); dark.accent = fit('dark', 'accent', accent, dark.paper); }
  // no second brand colour: HTTP/API edges get a deeper shade of the accent,
  // so the palette stays the brand's own instead of borrowing the default teal
  light.link = fit('light', 'link', link || (accent ? mix(accent, light.ink, 0.45) : DEFAULT.link), light.paper);
  dark.link = fit('dark', 'link', link || (accent ? mix(accent, dark.ink, 0.35) : DEFAULT.darkLink), dark.paper);
  return { light, dark, adjusted };
}

// ---- entry point -----------------------------------------------------------

// opts.fonts: "Family" (sans) or "sans=Family,serif=Family,mono=Family" to name
// typefaces directly; opts.checkGoogle replaces the Google Fonts lookup (tests).
export async function learnBrand(source, opts = {}) {
  const { colors } = opts;
  let found;
  let sources;
  let fonts = null;
  let roles = {};
  let faces = [];
  if (colors) {
    const listed = String(colors).split(/[\s,]+/).map(norm).filter(Boolean);
    if (listed.length < 1) return { ok: false, error: 'no colours recognised', fix: 'pass hex values like --colors "#D4A574,#E7E5E2,#1E1C1A"' };
    found = decide({ props: new Map(), decls: [], freq: new Map(listed.map((c) => [c, 1])) }, null, listed);
    sources = ['colour list'];
  } else {
    if (!source) return { ok: false, error: 'nothing to learn from', fix: 'pass a URL, a folder or file with CSS/theme tokens, or --colors "#hex,#hex,…"' };
    let collected;
    if (/^https?:\/\//i.test(source)) {
      try { collected = await fromUrl(source); } catch (e) { return { ok: false, error: `could not fetch ${source}: ${e.message}`, fix: 'check the URL, or pass the brand colours with --colors' }; }
    } else if (existsSync(source)) {
      collected = fromPath(source);
    } else {
      return { ok: false, error: `not a URL or a path: ${source}` };
    }
    const scanned = scan(collected.docs);
    if (!scanned.freq.size) return { ok: false, error: 'no colours found', sources: collected.docs.map((d) => d.from).slice(0, 8), fix: 'pass the brand colours with --colors "#hex,#hex,…"' };
    found = decide(scanned, collected.themeColor, null);
    sources = [...new Set(collected.docs.map((d) => d.from))].slice(0, 8);
    roles = decideFonts(scanned);
    faces = scanned.faces;
  }
  // typefaces named directly win over detected ones
  if (opts.fonts) {
    for (const part of String(opts.fonts).split(',')) {
      const [k, v] = part.includes('=') ? part.split('=') : ['sans', part];
      const role = k.trim().toLowerCase();
      const family = unquote(v || '').replace(/["'<>;{}\\]/g, '').slice(0, 60);
      if (FONT_ROLES[role] && family) roles[role] = { family, from: '--fonts' };
    }
  }
  if (Object.keys(roles).length) {
    const loaded = await sourceFonts(roles, faces, opts);
    fonts = { ...roles, ...(loaded.hrefs.length ? { href: loaded.hrefs } : {}), ...(loaded.faces ? { faces: loaded.faces } : {}) };
  }
  if (!colors && !source) return { ok: false, error: 'nothing to learn from' };
  const { light, dark, adjusted } = build(found);
  return {
    ok: true,
    sources,
    found: Object.fromEntries(Object.entries(found.evidence).map(([role, e]) => [role, `${e.value} (${e.from})`])),
    light,
    dark,
    ...(adjusted.length ? { adjusted } : {}),
    ...(found.accent ? {} : { note: 'no clear brand accent found: diagrams keep the default accent; pass --colors to set one' }),
    ...(fonts ? { fonts } : {}),
  };
}
