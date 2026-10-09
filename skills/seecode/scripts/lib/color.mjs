// Colour maths for brand palettes: parsing, WCAG contrast, mixing, and turning
// a few brand roles (paper, ink, accent, link) into a complete diagram skin.

const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000', orange: '#ffa500', purple: '#800080', navy: '#000080', teal: '#008080', gray: '#808080', grey: '#808080', tan: '#d2b48c', ivory: '#fffff0', beige: '#f5f5dc', gold: '#ffd700', crimson: '#dc143c', coral: '#ff7f50', indigo: '#4b0082', silver: '#c0c0c0', maroon: '#800000', olive: '#808000' };

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

// Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla(), a few names.
// Returns {r,g,b,a} (0–255, alpha 0–1) or null.
export function parse(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (NAMED[s]) return parse(NAMED[s]);
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const ch = (v) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v));
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a };
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const { r, g, b } = fromHsl(parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r, g, b, a };
  }
  return null;
}

export const toHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const norm = (c) => { const p = parse(c); return p ? toHex(p) : null; };

export function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function fromHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function luminance(c) {
  const p = typeof c === 'string' ? parse(c) : c;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(p.r) + 0.7152 * lin(p.g) + 0.0722 * lin(p.b);
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const saturation = (c) => toHsl(parse(c)).s;
export const isDark = (c) => luminance(c) < 0.18;

// Mix a toward b by t (0 = a, 1 = b), in sRGB.
export function mix(a, b, t) {
  const p = parse(a), q = parse(b);
  return toHex({ r: p.r + (q.r - p.r) * t, g: p.g + (q.g - p.g) * t, b: p.b + (q.b - p.b) * t });
}

export function rgba(c, alpha) {
  const p = parse(c);
  return `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)},${alpha})`;
}

// Move a colour's lightness (keeping hue and saturation) until it reaches the
// target contrast against bg. Returns the original if it already passes.
export function ensureContrast(fg, bg, target) {
  if (contrast(fg, bg) >= target) return norm(fg);
  const hsl = toHsl(parse(fg));
  const darker = !isDark(bg);
  for (let i = 1; i <= 100; i++) {
    const l = clamp(hsl.l + (darker ? -i : i) / 100);
    const c = toHex(fromHsl(hsl.h, hsl.s, l));
    if (contrast(c, bg) >= target) return c;
  }
  return darker ? '#000000' : '#ffffff';
}

// Contrast targets: body text (WCAG AA), small accent text and marks, and
// strokes/large text (WCAG AA for graphics).
export const TARGETS = { ink: 4.5, accent: 3, link: 3 };

// Brand roles → every token the diagram stylesheet uses. Only the roles a
// brand provides are required; the rest are derived from paper and ink so a
// brand looks coherent instead of half-default.
export function expandRoles({ paper, ink, accent, link, muted }, base) {
  const dark = isDark(paper);
  const out = { ...base, paper, ink };
  out['paper-2'] = mix(paper, ink, dark ? 0.06 : 0.05);
  out['ink-strong'] = mix(ink, dark ? '#ffffff' : '#000000', 0.5);
  out.muted = muted || mix(ink, paper, 0.32);
  out.soft = mix(ink, paper, 0.52);
  out.rule = rgba(ink, 0.12);
  out['rule-solid'] = mix(ink, paper, 0.74);
  out.node = dark ? mix(paper, ink, 0.035) : mix(paper, '#ffffff', 0.55);
  out.store = rgba(ink, 0.05);
  out.external = rgba(ink, 0.025);
  if (accent) {
    out.accent = accent;
    out['accent-tint'] = rgba(accent, dark ? 0.14 : 0.1);
  }
  if (link) out.link = link;
  // isometric face shading follows the paper: darken toward ink on light
  // paper, toward black (with a slight top highlight) on dark paper
  Object.assign(out, dark
    ? { 'ax-shade': '#000000', 'ax-lift': '#ffffff', 'ax-screen': '#07080b', 'ax-dark-edge': 'rgba(255,255,255,0.34)', 'ax-t-o': '0.06', 'ax-l-o': '0.2', 'ax-r-o': '0.42' }
    : { 'ax-shade': ink, 'ax-lift': '#ffffff', 'ax-screen': mix(ink, '#2b3040', 0.5), 'ax-dark-edge': 'rgba(255,255,255,0)', 'ax-t-o': '0', 'ax-l-o': '0.07', 'ax-r-o': '0.16' });
  return out;
}
