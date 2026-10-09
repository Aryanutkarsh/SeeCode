// Isometric object: one thing drawn from parts placed anywhere in 3D, so a
// plain description ("an office chair", "a desk lamp") becomes a drawing.
// A part is either a solid (centre x, y; base z; w × d × h, with the full
// item / side / hollow / rings / top grammar) or a beam between two points
// (legs, poles, frames, handles, cables). Parts paint back to front by a 3D
// topological sort. Named parts are labelled in a column on the right.
import { el, text } from '../../svg.mjs';
import { textWidth } from '../../text.mjs';
import { iso, outline, lyingCylinder } from './axon.mjs';
import { dressedSolid, resolve } from './iso-detail.mjs';

export const family = 'structure';

const NAME = { size: 13, weight: 600 };
const SUBF = { size: 9, mono: true, tracking: 0.06 };
const GAP = 30; // minimum vertical distance between two labels

// a part's 3D bounds, for sorting and framing
function bounds(p) {
  if (p.from) {
    const t = p.thick / 2;
    return { x0: Math.min(p.from[0], p.to[0]) - t, x1: Math.max(p.from[0], p.to[0]) + t, y0: Math.min(p.from[1], p.to[1]) - t, y1: Math.max(p.from[1], p.to[1]) + t, z0: Math.min(p.from[2], p.to[2]) - t, z1: Math.max(p.from[2], p.to[2]) + t };
  }
  return { x0: p.rect.x0, x1: p.rect.x1, y0: p.rect.y0, y1: p.rect.y1, z0: p.z, z1: p.z + p.h + (p.capH || 0) };
}

// A paints before B when A lies wholly behind or below B on some axis (and B
// is not also behind A). Unrelated parts keep their order by depth.
function paintOrder(parts) {
  const n = parts.length;
  const B = parts.map(bounds);
  const eps = 1e-6;
  const before = (a, b) => a.x1 <= b.x0 + eps || a.y1 <= b.y0 + eps || a.z1 <= b.z0 + eps;
  const after = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    if (before(B[i], B[j]) && !before(B[j], B[i])) { after[i].push(j); indeg[j]++; }
  }
  const key = (i) => (B[i].x0 + B[i].x1 + B[i].y0 + B[i].y1) / 2 + (B[i].z0 + B[i].z1) / 2;
  const ready = [...Array(n).keys()].filter((i) => !indeg[i]);
  const out = [];
  while (ready.length) {
    ready.sort((a, b) => key(a) - key(b));
    const i = ready.shift();
    out.push(i);
    for (const j of after[i]) if (--indeg[j] === 0) ready.push(j);
  }
  const rest = [...Array(n).keys()].filter((i) => !out.includes(i)).sort((a, b) => key(a) - key(b));
  return [...out, ...rest].map((i) => parts[i]);
}

// A beam: a rod between two 3D points, drawn as a rounded band with an outline
function beam(p) {
  const a = iso(...p.from), b = iso(...p.to);
  const d = `M${a.x},${a.y} L${b.x},${b.y}`;
  const tone = p.tone === 'dark' ? ' iso-beam-dark' : p.tone === 'accent' ? ' iso-beam-accent' : '';
  return {
    svg: el('path', { class: 'iso-beam-o', d, 'stroke-width': p.thick + 2.4 }) + el('path', { class: `iso-beam${tone}`, d, 'stroke-width': p.thick }),
    sil: [a, b].flatMap((q) => [{ x: q.x - p.thick / 2, y: q.y - p.thick / 2 }, { x: q.x + p.thick / 2, y: q.y + p.thick / 2 }]),
    anchor: a.x >= b.x ? a : b,
  };
}

// Scale every length in a part (and its items) by k, so any object is drawn
// at a readable size whatever units the spec used. Fractions stay as they are.
function scalePart(o, k) {
  const L = (v) => (typeof v === 'number' ? v * k : v);
  const items = (list) => list && list.map((it) => ({ ...it, h: L(it.h), topH: L(it.topH), r: L(it.r), hollow: L(it.hollow), items: items(it.items) }));
  return {
    ...o,
    ...(o.from ? { from: o.from.map(L), to: o.to.map(L), thick: L(o.thick ?? 6) } : {}),
    // defaults are in the spec's own units, so they scale with everything else
    x: L(o.x), y: L(o.y), z: L(o.z), ...(o.from ? {} : { w: L(o.w ?? DEF.w), d: L(o.d ?? DEF.d), h: L(o.h ?? DEF.h) }), r: L(o.r), topH: L(o.topH), hollow: L(o.hollow),
    items: items(o.items),
  };
}

const TARGET = 420; // px: the larger side of the drawn object
const DEF = { w: 40, d: 40, h: 10 }; // a solid's size when the spec leaves it out

export function render(spec) {
  const problems = [];
  // measure the object as given, then scale it to the target size
  const raw = spec.parts.map((o) => (o.from ? [o.from, o.to] : [[(o.x ?? 0) - (o.w ?? DEF.w) / 2, (o.y ?? 0) - (o.d ?? DEF.d) / 2, o.z ?? 0], [(o.x ?? 0) + (o.w ?? DEF.w) / 2, (o.y ?? 0) + (o.d ?? DEF.d) / 2, (o.z ?? 0) + (o.h ?? DEF.h) + (o.topH ?? 0)]]))
    .flat().flatMap(([x0, y0, z0]) => [iso(x0, y0, z0)]);
  const bx = Math.max(...raw.map((q) => q.x)) - Math.min(...raw.map((q) => q.x)), by = Math.max(...raw.map((q) => q.y)) - Math.min(...raw.map((q) => q.y));
  const k = spec.scale ?? Math.min(40, Math.max(0.02, TARGET / Math.max(bx, by, 1e-6)));
  const parts = spec.parts.map((o0, i) => {
    const o = k === 1 ? o0 : scalePart(o0, k);
    const id = o.id || `p${i}`;
    if (o.from) return { ...o, id, thick: o.thick ?? 6 };
    const w = o.w ?? DEF.w, d = o.d ?? DEF.d, h = o.h ?? DEF.h;
    const res = resolve(o, w, d, h);
    const rr = res.r === 'round' ? Math.min(w, d) / 2 : Math.max(0, Math.min(res.r ?? 0, w / 2, d / 2));
    const capH = res.top ? res.topH ?? Math.min(w, d) * 0.35 : 0;
    const x = o.x ?? 0, y = o.y ?? 0;
    return { ...o, id, w, d, h, res, capH, z: o.z ?? 0, rect: { x0: x - w / 2, y0: y - d / 2, x1: x + w / 2, y1: y + d / 2, r: rr } };
  });
  const ids = new Set();
  for (const p of parts) {
    if (ids.has(p.id)) problems.push({ code: 'E_DUP_ID', at: `parts.${p.id}`, msg: `duplicate id "${p.id}"`, fix: 'ids must be unique' });
    ids.add(p.id);
  }
  if (problems.length) return { problems };
  if (parts.length > 40) problems.push({ code: 'W_BUDGET', at: 'parts', msg: `${parts.length} parts`, fix: 'merge small parts; 5–25 parts read best' });
  if (parts.filter((p) => p.focal).length > 1) problems.push({ code: 'W_FOCAL', at: 'parts', msg: 'more than one focal part', fix: 'keep the accent on one part' });

  // reveal bottom-up: each distinct base height is a step (at most 12)
  const bases = [...new Set(parts.map((p) => Math.round(bounds(p).z0)))].sort((a, b) => a - b);
  const stepOf = (p) => Math.min(12, 1 + Math.round((bases.indexOf(Math.round(bounds(p).z0)) * 11) / Math.max(1, bases.length - 1)));

  const out = [];
  const drawn = [];
  for (const p of paintOrder(parts)) {
    const st = stepOf(p);
    let svg, sil, anchor;
    if (p.from) ({ svg, sil, anchor } = beam(p));
    else if (p.axis === 'x' || p.axis === 'y') {
      // a round part lying on its side: w × d is its footprint, h its diameter
      const len = p.axis === 'x' ? p.w : p.d, rad = p.h / 2;
      const cx = (p.rect.x0 + p.rect.x1) / 2, cy = (p.rect.y0 + p.rect.y1) / 2;
      const c = lyingCylinder(p.axis, cx, cy, p.z + rad, rad, len, p.tone ? `it-solid it-${p.tone}` : '');
      svg = c.svg;
      sil = c.sil;
      const o = sil.reduce((m, q) => (q.x > m.x ? q : m), sil[0]);
      p.candidates = [o, iso(cx, cy, p.z + rad)];
    } else {
      const ds = dressedSolid({ rect: p.rect, t: p.h, ...p.res }, p.z, { cls: p.tone ? `it-solid it-${p.tone}` : '' });
      svg = ds.back + (ds.front || '');
      sil = ds.sil;
      // candidate label points: down the part's right edge, at mid-thickness first
      anchor = null;
      // (on the real outline, so a rounded corner is not missed)
      const ol = outline(p.rect);
      const ext = ol.reduce((m, q) => (q.x - q.y > m.x - m.y ? q : m), ol[0]);
      const front = ol.reduce((m, q) => (q.x + q.y > m.x + m.y ? q : m), ol[0]);
      p.candidates = [0.5, 0.25, 0.75, 0.1, 0.9].map((f) => iso(ext.x, ext.y, p.z + p.h * f))
        .concat([0.5, 0.25].map((f) => iso((ext.x + front.x) / 2, (ext.y + front.y) / 2, p.z + p.h * f)));
    }
    drawn.push({ p, sil, anchor, cands: p.from ? [anchor, iso(...p.from), iso(...p.to)] : p.candidates });
    out.push(el('g', {
      class: `${p.label ? 'sc-node ' : ''}iso-part iso-obj ${p.focal ? 'k-focal' : 'k-backend'} sc-drop`,
      ...(p.label ? { 'data-sc-node': p.id, tabindex: 0, role: 'group', 'aria-label': [p.label, p.sub].filter(Boolean).join(', ') } : {}),
      'data-sc-step': st,
      style: `--step:${st}`,
    }, svg));
  }

  // each label points at a spot of its part that nothing painted later covers
  const hulls = drawn.map((d) => convex(d.sil));
  drawn.forEach((d, i) => {
    const free = (q) => !hulls.slice(i + 1).some((h) => inside(q, h));
    const pick = d.cands.filter(Boolean).find(free);
    d.anchor = pick || d.anchor || d.cands[0];
  });

  // labels: one column right of the object, sorted top to bottom, kept apart
  const all = drawn.flatMap((d) => d.sil);
  let x0 = Math.min(...all.map((q) => q.x)), x1 = Math.max(...all.map((q) => q.x));
  let y0 = Math.min(...all.map((q) => q.y)), y1 = Math.max(...all.map((q) => q.y));
  const named = drawn.filter((d) => d.p.label && spec.labels !== false).sort((a, b) => a.anchor.y - b.anchor.y);
  if (named.length) {
    const colX = x1 + 56;
    let last = -Infinity;
    const ys = named.map((d) => (last = Math.max(d.anchor.y, last + GAP)));
    named.forEach((d, i) => {
      const y = ys[i];
      const st = stepOf(d.p);
      const parts2 = [
        el('circle', { class: 'iso-dot', cx: d.anchor.x, cy: d.anchor.y, r: 2 }),
        el('path', { class: 'iso-leader', 'data-role': 'leader', d: `M${d.anchor.x + 4},${d.anchor.y} L${colX - 28},${y} L${colX - 10},${y}` }),
        text({ class: 'iso-name', 'data-role': 'name', x: colX, y: d.p.sub ? y - 2 : y + 4 }, d.p.label),
      ];
      if (d.p.sub) parts2.push(text({ class: 'iso-sub', x: colX, y: y + 11 }, d.p.sub.toUpperCase()));
      out.push(el('g', { class: `iso-label ${d.p.focal ? 'k-focal' : 'k-backend'}`, 'data-sc-step': st, style: `--step:${st}`, 'aria-hidden': 'true' }, parts2));
    });
    const labelW = Math.max(...named.map((d) => Math.max(textWidth(d.p.label, NAME), d.p.sub ? textWidth(d.p.sub.toUpperCase(), SUBF) : 0)));
    x1 = colX + labelW;
    y0 = Math.min(y0, ys[0] - 14);
    y1 = Math.max(y1, ys[ys.length - 1] + 16);
  }
  return {
    body: el('g', { class: 'sc-nodes iso-object' }, out),
    viewBox: [x0 - 24, y0 - 24, x1 - x0 + 48, y1 - y0 + 48],
    steps: Math.min(12, bases.length),
    problems,
    graph: { nodes: parts.filter((p) => p.label).map((p) => ({ id: p.id, label: p.label })), edges: [] },
  };
}

// convex hull (monotone chain) and point-in-convex-polygon, for occlusion
function convex(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function inside(q, poly) {
  if (poly.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

export const OBJECT_CSS = `
.iso-beam-o{fill:none;stroke:var(--sc-ink);stroke-linecap:round}
.iso-beam{fill:none;stroke:var(--sc-node);stroke-linecap:round}
.iso-beam-dark{stroke:var(--sc-ax-screen)}
.iso-beam-accent,.k-focal .iso-beam{stroke:var(--sc-accent);stroke-opacity:.55}
.iso-leader{fill:none;stroke:var(--sc-ink);stroke-opacity:.4;stroke-width:.8}
.k-focal .iso-leader{stroke:var(--sc-accent);stroke-opacity:1}
`;
