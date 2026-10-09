// A general composition engine for isometric solids. Any part (exploded) or
// box (plan) is a rounded prism that can be made hollow, ribbed, and dressed
// with items:
//
//   items  on its top face: raised boxes/cylinders, flat panels, holes, rings,
//          lines of text, dot grids. Placed in fractions of the face
//          (box:[u0,v0,u1,v1] or at:[u,v] + size:[w,d]), optionally repeated
//          in a grid, and nested (items on an item's own top).
//   side   on its visible walls (left = the front-left face, right = the
//          front-right face): panels, lines (windows, shelves, vents), and
//          buttons. u runs along the wall, v from bottom (0) to top (1).
//
// `kind` names a preset written in this same language (see PRESETS): a
// shorthand, never a special case. Nothing here knows what a phone is.
import { el } from '../../svg.mjs';
import { iso, prism, outline, cappedPrism, capHeight } from './axon.mjs';

const P = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z';
const seg = (a, b) => `M${a.x},${a.y} L${b.x},${b.y}`;
const arcPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

export const inset = (r, m, rad) => ({ x0: r.x0 + m, y0: r.y0 + m, x1: r.x1 - m, y1: r.y1 - m, r: Math.max(0, rad ?? (r.r || 0) - m) });
const W = (r) => r.x1 - r.x0, D = (r) => r.y1 - r.y0;

// corner radius: a number (units), "round" (a cylinder or pill), or default
const radius = (spec, w, d, dflt = 0) => (spec === 'round' ? Math.min(w, d) / 2 : Math.max(0, Math.min(typeof spec === 'number' ? spec : dflt, w / 2, d / 2)));

// ---- placing on a face -------------------------------------------------------

// the item's rectangle on parent face R, in model units
function place(R, it) {
  let [u0, v0, u1, v1] = it.box || [0, 0, 1, 1];
  if (it.at) {
    const [w, d] = it.size || [0.2, 0.2];
    [u0, v0, u1, v1] = [it.at[0] - w / 2, it.at[1] - d / 2, it.at[0] + w / 2, it.at[1] + d / 2];
  }
  const r = { x0: R.x0 + u0 * W(R), y0: R.y0 + v0 * D(R), x1: R.x0 + u1 * W(R), y1: R.y0 + v1 * D(R) };
  // "inherit" follows the parent's corners, less the inset
  r.r = it.r === 'inherit' ? Math.max(0, Math.min((R.r || 0) - Math.min(r.x0 - R.x0, r.y0 - R.y0), W(r) / 2, D(r) / 2)) : radius(it.r, W(r), D(r), 0);
  return r;
}

// repeat:[cols,rows] fills the item's box with a grid; each cell holds a copy
// scaled by `fill` (default 0.7) of the cell
function cells(R, it) {
  const area = place(R, { ...it, r: 0 });
  const [cols, rows] = it.repeat;
  const f = it.fill ?? 0.7;
  const cw = W(area) / cols, rh = D(area) / rows;
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = area.x0 + (i + 0.5) * cw, cy = area.y0 + (j + 0.5) * rh;
    const w = cw * f, d = rh * f;
    const r = { x0: cx - w / 2, y0: cy - d / 2, x1: cx + w / 2, y1: cy + d / 2 };
    r.r = radius(it.r, w, d, 0);
    out.push(r);
  }
  return out;
}

// tone → class: how an item is coloured
const TONE = { light: 'it-light', dark: 'it-dark', black: 'it-black', accent: 'it-accent', mid: 'it-mid', cut: 'it-cut', line: 'it-line', text: 'it-text' };
const toneOf = (it, dflt) => TONE[it.tone] || TONE[dflt];
// strokes (rings, lines, text) take a tone too
const STROKE = { accent: ' it-stroke-accent', light: ' it-stroke-light', dark: ' it-stroke-dark' };

const faceAt = (r, z) => outline(r).map((p) => iso(p.x, p.y, z));

// Draws `items` on face R at height z. Flat items paint first, then raised
// ones back to front, so raised items cover what lies behind them.
export function drawItems(R, z, items = []) {
  const flat = [], raised = [];
  for (const it of items) {
    const rects = it.repeat ? cells(R, it) : [place(R, it)];
    for (const r of rects) (it.h ? raised : flat).push({ it, r });
  }
  raised.sort((a, b) => (a.r.x0 + a.r.y0) - (b.r.x0 + b.r.y0));
  // on a shaped top, z is a function: each item sits at the height under its centre
  const zOf = (r) => (typeof z === 'function' ? z((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2) : z);
  const out = [];
  for (const { it, r } of flat) out.push(flatItem(it, r, zOf(r)));
  for (const { it, r } of raised) {
    const z0 = zOf(r);
    const cls = `it-solid ${toneOf(it, 'light')}`;
    if (it.top) {
      const th = it.topH ?? Math.min(W(r), D(r)) * 0.35;
      out.push(cappedPrism(it.top === 'dome' ? r : { ...r, r: 0 }, z0, it.h, it.top, th, { cls }).svg);
      out.push(drawItems(r, capSurface(r, z0 + it.h, th, it.top), it.items));
      continue;
    }
    if (it.hollow) {
      const wall = typeof it.hollow === 'number' ? it.hollow : Math.max(1.5, Math.min(W(r), D(r)) * 0.08);
      // what sits inside (coffee in a cup) paints between the back and the front
      out.push(hollowBack(r, z0, it.h, wall), drawItems(inset(r, wall), z0 + Math.min(2, it.h / 4), it.items), hollowFront(r, z0, it.h, wall, []));
      continue;
    }
    out.push(prism(r, z0, it.h, { cls }).svg);
    if (it.rings) out.push(rings(r, z0, it.h));
    out.push(drawItems(r, z0 + it.h, it.items));
  }
  return out.join('');
}

function flatItem(it, r, z) {
  const shape = it.shape || 'panel';
  if (shape === 'lines' || shape === 'text') return lines(it, r, z);
  if (shape === 'ring') return el('path', { class: `${TONE.line}${STROKE[it.tone] || ''}${it.dash ? ' it-dash' : ''}`, d: P(faceAt(r, z)) });
  if (shape === 'hole') return el('path', { class: TONE.cut, d: P(faceAt(r, z)) });
  // panel (also dots, which are round repeated panels)
  const cls = toneOf(it, shape === 'dots' ? 'dark' : 'mid');
  return el('path', { class: cls, d: P(faceAt(shape === 'dots' ? { ...r, r: Math.min(W(r), D(r)) / 2 } : r, z)) }) + drawItems(r, z, it.items);
}

// parallel lines across a box: text (ragged lengths), rules, vents
function lines(it, r, z) {
  const n = it.n || 4;
  const vertical = it.dir === 'v';
  const ragged = it.shape === 'text' || it.ragged;
  const LEN = [0.9, 0.65, 0.8, 0.5, 0.75, 0.6];
  const d = [];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const len = ragged ? LEN[k % LEN.length] : 1;
    const a = vertical ? { x: r.x0 + t * W(r), y: r.y0 } : { x: r.x0, y: r.y0 + t * D(r) };
    const b = vertical ? { x: a.x, y: r.y0 + len * D(r) } : { x: r.x0 + len * W(r), y: a.y };
    d.push(seg(iso(a.x, a.y, z), iso(b.x, b.y, z)));
  }
  return el('path', { class: `${it.shape === 'text' ? TONE.text : TONE.line}${STROKE[it.tone] || ''}${it.dash ? ' it-dash' : ''}`, d: d.join(' ') });
}

// ---- sides: the two visible walls ------------------------------------------

// A point on a wall: left wall is y = y1 (u: x0 → x1), right wall is x = x1
// (u: y1 → y0, so u runs left to right on screen for both); v: z0 → z1.
function wallPoint(R, z0, t, face, u, v, out = 0) {
  const z = z0 + v * t;
  return face === 'right' ? iso(R.x1 + out, R.y1 - u * D(R), z) : iso(R.x0 + u * W(R), R.y1 + out, z);
}

export function drawSide(R, z0, t, side = []) {
  const out = [];
  for (const it of side) {
    const faces = it.face === 'both' ? ['left', 'right'] : [it.face || 'left'];
    for (const face of faces) {
      const boxes = it.repeat ? gridBoxes(it) : [it.box || [0.1, 0.3, 0.9, 0.7]];
      for (const [u0, v0, u1, v1] of boxes) {
        const shape = it.shape || 'panel';
        if (shape === 'lines' || shape === 'text') {
          const n = it.n || Math.max(1, Math.round(((v1 - v0) * t) / 12));
          const d = [];
          for (let k = 0; k < n; k++) {
            const v = v0 + ((k + 0.5) / n) * (v1 - v0);
            if (it.dir === 'v') { const u = u0 + ((k + 0.5) / n) * (u1 - u0); d.push(seg(wallPoint(R, z0, t, face, u, v0), wallPoint(R, z0, t, face, u, v1))); } else d.push(seg(wallPoint(R, z0, t, face, u0, v), wallPoint(R, z0, t, face, u1, v)));
          }
          out.push(el('path', { class: `${TONE.line}${it.dash ? ' it-dash' : ''}${it.tone === 'dark' ? ' it-stroke-dark' : ''}`, d: d.join(' ') }));
        } else {
          const o = shape === 'button' ? 1.5 : 0;
          const quad = [wallPoint(R, z0, t, face, u0, v1, o), wallPoint(R, z0, t, face, u1, v1, o), wallPoint(R, z0, t, face, u1, v0, o), wallPoint(R, z0, t, face, u0, v0, o)];
          out.push(el('path', { class: shape === 'button' ? 'it-button' : toneOf(it, 'mid'), d: P(quad) }));
        }
      }
    }
  }
  return out.join('');
}

function gridBoxes(it) {
  const [u0, v0, u1, v1] = it.box || [0, 0, 1, 1];
  const [cols, rows] = it.repeat;
  const f = it.fill ?? 0.6;
  const cw = (u1 - u0) / cols, rh = (v1 - v0) / rows;
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cu = u0 + (i + 0.5) * cw, cv = v0 + (j + 0.5) * rh;
    out.push([cu - (cw * f) / 2, cv - (rh * f) / 2, cu + (cw * f) / 2, cv + (rh * f) / 2]);
  }
  return out;
}

// ---- rims, rings and hollow solids -----------------------------------------

// the part of an outline the viewer sees (front) or not (back) at height z
function arc(r, z, front) {
  const pts = outline(r);
  const n = pts.length;
  const vis = pts.map((a, i) => { const b = pts[(i + 1) % n]; return ((b.y - a.y) - (b.x - a.x) > 1e-9) === front; });
  let s = vis.findIndex((v, i) => v && !vis[(i - 1 + n) % n]);
  if (s < 0) s = 0;
  const out = [];
  for (let k = 0; k < n && vis[(s + k) % n]; k++) out.push(pts[(s + k) % n]);
  out.push(pts[(s + out.length) % n]);
  return out.map((p) => iso(p.x, p.y, z));
}
export const frontArc = (r, z) => arc(r, z, true);

// horizontal ribs around a solid's visible sides
export function rings(r, z, t, step = 8) {
  const d = [];
  for (let zz = z + step; zz < z + t - 2; zz += step) d.push(arcPath(frontArc(r, zz)));
  return d.length ? el('path', { class: TONE.line, d: d.join(' ') }) : '';
}

// A hollow solid (a tray, a case, a box, a room shell) paints in two halves:
// the back (outside, rim and cavity) before what sits inside it, and the front
// walls and rim after, so parts inside show correctly.
export function hollowBack(r, z, t, wall) {
  const inner = inset(r, wall);
  const solid = prism(r, z, t, { silhouette: false });
  const top = faceAt(r, z + t);
  return el('g', { class: 'iso-hollow-back' }, [
    el('path', { class: 'iso-base', d: P(solid.sil) }),
    el('path', { class: 'iso-base', d: P(top) }),
    el('path', { class: 'iso-t', d: P(top) }),
    el('path', { class: 'it-cavity', d: P(faceAt(inner, z + t)) }),
    el('path', { class: 'it-floor', d: P(faceAt(inner, z + Math.min(2, t / 4))) }),
    el('path', { class: TONE.line, d: P(faceAt(inner, z + t)) }),
    el('path', { class: 'iso-sil', d: arcPath(arc(r, z + t, false)) }),
  ]);
}

export function hollowFront(r, z, t, wall, side) {
  const inner = inset(r, wall);
  const solid = prism(r, z, t, { silhouette: false });
  // the solid's side faces only (its top would cover the cavity)
  const sides = solid.svg.replace(/<path class="iso-base" d="[^"]*"\/><path class="iso-t"[^>]*\/>/, '').replace(/<path class="iso-edge" d="[^"]*"\/>/, '');
  const outerTop = frontArc(r, z + t), innerTop = frontArc(inner, z + t), outerBot = frontArc(r, z);
  const rim = [...outerTop, ...[...innerTop].reverse()];
  const l = outerTop[0], rr = outerTop[outerTop.length - 1], lb = outerBot[0], rb = outerBot[outerBot.length - 1];
  return el('g', { class: 'iso-hollow-front' }, [
    sides,
    el('path', { class: 'iso-base', d: P(rim) }),
    el('path', { class: 'iso-t', d: P(rim) }),
    el('path', { class: TONE.line, d: arcPath(innerTop) }),
    drawSide(r, z, t, side),
    el('path', { class: 'iso-sil', d: `${seg(l, lb)} ${arcPath(outerBot)} ${seg(rb, rr)} ${arcPath(outerTop)}` }),
  ]);
}

const capSurface = (r, z, h, shape) => { const f = capHeight(r, h, shape); return (x, y) => z + f(x, y); };

// ---- one solid, fully dressed ----------------------------------------------

// spec: { rect, t, hollow?, rings?, items?, side? }. Returns the parts to
// paint now (`back`), and for a hollow solid the `front` to paint after
// whatever sits inside it.
export function dressedSolid(s, z, { cls = '' } = {}) {
  const env = prism(s.rect, z, s.t, { cls });
  if (s.hollow) {
    const wall = typeof s.hollow === 'number' ? s.hollow : Math.max(4, Math.min(W(s.rect), D(s.rect)) * 0.04);
    return { back: hollowBack(s.rect, z, s.t, wall) + drawItems(inset(s.rect, wall), z + Math.min(2, s.t / 4), s.items), front: hollowFront(s.rect, z, s.t, wall, s.side), sil: env.sil, top: env.top, wall };
  }
  if (s.top) {
    // walls, then a dome or roof; items drape over the cap
    const th = s.topH ?? Math.min(W(s.rect), D(s.rect)) * 0.35;
    const capped = cappedPrism(s.top === 'dome' ? s.rect : { ...s.rect, r: 0 }, z, s.t, s.top, th, { cls });
    const back = capped.svg + (s.rings ? rings(s.rect, z, s.t) : '') + drawSide(s.rect, z, s.t, s.side) + drawItems(s.rect, capSurface(s.rect, z + s.t, th, s.top), s.items);
    return { back, sil: capped.sil, top: capped.top, capH: th };
  }
  const back = env.svg + (s.rings ? rings(s.rect, z, s.t) : '') + drawSide(s.rect, z, s.t, s.side) + drawItems(s.rect, z + s.t, s.items);
  return { back, sil: env.sil, top: env.top };
}

// ---- presets: shorthands in the same language ------------------------------

// Each returns extra props for a solid of footprint w×d and height t. They are
// starting points the spec can extend with its own items and side.
export const PRESETS = {
  screen: () => ({ items: [{ box: [0.03, 0.03, 0.97, 0.97], tone: 'dark', r: 'inherit' }] }),
  display: () => ({ items: [{ box: [0.03, 0.03, 0.97, 0.97], tone: 'dark', r: 'inherit', items: [{ at: [0.5, 0.06], size: [0.22, 0.03], r: 'round', tone: 'black' }] }] }),
  terminal: () => ({ items: [{ box: [0.06, 0.06, 0.94, 0.94], tone: 'dark', r: 3, items: [{ shape: 'text', box: [0.08, 0.1, 0.9, 0.9], n: 5, tone: 'light' }] }] }),
  board: () => ({ items: [{ box: [0.55, 0.08, 0.92, 0.34], h: 3, tone: 'dark', r: 1 }, { box: [0.1, 0.56, 0.4, 0.86], h: 2, tone: 'dark', r: 1 }, { box: [0.52, 0.56, 0.92, 0.78], h: 2, tone: 'dark', r: 1 }] }),
  pcb: (w, d) => ({ items: [{ shape: 'dots', repeat: [Math.max(3, Math.round(w / 18)), Math.max(2, Math.round(d / 18))], fill: 0.3 }, { box: [0.3, 0.5, 0.48, 0.66], h: 2, tone: 'dark', r: 1 }] }),
  battery: () => ({ items: [{ shape: 'ring', box: [0.08, 0.08, 0.92, 0.92] }, { box: [0.12, 0.01, 0.4, 0.06], tone: 'dark' }] }),
  plate: (w, d) => ({ items: [{ shape: 'hole', repeat: [Math.max(4, Math.round(w / 20)), Math.max(2, Math.round(d / 20))], fill: 0.6, r: 1 }] }),
  keys: (w, d) => ({ items: [{ repeat: [Math.max(4, Math.round(w / 22)), Math.max(2, Math.round(d / 22))], fill: 0.86, h: 7, tone: 'light', r: 2, items: [{ shape: 'lines', box: [0.2, 0.25, 0.5, 0.35], n: 1, tone: 'text' }] }] }),
  switches: (w, d) => ({ items: [{ repeat: [Math.max(4, Math.round(w / 22)), Math.max(2, Math.round(d / 22))], fill: 0.5, h: 6, tone: 'accent', r: 1 }] }),
  cards: () => ({ items: [{ repeat: [3, 2], fill: 0.82, h: 3, tone: 'light', r: 2, items: [{ shape: 'text', box: [0.12, 0.25, 0.9, 0.85], n: 3 }, { box: [0.6, 0.08, 0.88, 0.16], tone: 'accent' }] }] }),
  chip: () => ({ items: [{ shape: 'lines', box: [0.36, 0.06, 0.64, 0.94], n: 6, dir: 'v' }, { shape: 'lines', box: [0.06, 0.36, 0.94, 0.64], n: 6 }, { box: [0.28, 0.28, 0.72, 0.72], h: 4, tone: 'dark', r: 3, items: [{ shape: 'ring', box: [0.12, 0.12, 0.88, 0.88], tone: 'light' }] }] }),
  studs: () => ({ items: [{ repeat: [3, 3], fill: 0.4, h: 4, r: 'round', tone: 'dark' }] }),
  speaker: () => ({ rings: true, r: 'round', items: [{ shape: 'ring', box: [0.12, 0.12, 0.88, 0.88], r: 'round' }, { at: [0.5, 0.5], size: [0.26, 0.26], r: 'round', tone: 'accent' }] }),
  lid: () => ({ items: [{ shape: 'ring', box: [0.07, 0.07, 0.93, 0.93] }, { shape: 'ring', at: [0.5, 0.5], size: [0.16, 0.16], r: 'round', tone: 'dark' }, { at: [0.5, 0.5], size: [0.06, 0.06], r: 'round', tone: 'black' }] }),
  vault: () => ({ items: [{ shape: 'ring', box: [0.05, 0.05, 0.95, 0.95], dash: true }, { at: [0.5, 0.5], size: [0.32, 0.32], r: 'round', h: 3, tone: 'light', items: [{ shape: 'ring', box: [0.2, 0.2, 0.8, 0.8], r: 'round' }, { at: [0.5, 0.5], size: [0.2, 0.2], r: 'round', tone: 'black' }] }] }),
  bun: () => ({ r: 'round', top: 'dome', topH: undefined }),
  house: (w, d, t) => ({ top: 'gable', topH: Math.min(w, d) * 0.45, side: [{ face: 'left', shape: 'panel', box: [0.42, 0, 0.58, 0.6], tone: 'mid' }, { face: 'both', shape: 'panel', repeat: [2, 1], box: [0.08, 0.45, 0.92, 0.8], fill: 0.35, tone: 'mid' }] }),
  housing: () => ({ hollow: true }),
  tray: () => ({ hollow: true }),
  // plan furniture and buildings
  desk: () => ({ items: [{ box: [0.3, 0.1, 0.7, 0.16], h: 10, tone: 'dark' }] }),
  table: () => ({ r: 'round', items: [{ shape: 'ring', box: [0.15, 0.15, 0.85, 0.85], r: 'round' }] }),
  counter: () => ({ items: [{ shape: 'ring', box: [0.04, 0.1, 0.96, 0.9] }] }),
  post: () => ({ r: 'round' }),
  rack: (w, d, t) => ({ side: [{ face: 'both', shape: 'lines', box: [0, 0, 1, 1], n: Math.max(2, Math.round(t / 12)) }, { face: 'both', shape: 'lines', dir: 'v', box: [0, 0, 1, 1], n: Math.max(2, Math.round(Math.max(w, d) / 24)) }] }),
  building: (w, d, t) => ({ items: [{ shape: 'ring', box: [0.03, 0.03, 0.97, 0.97], dash: true }], side: [{ face: 'both', shape: 'lines', box: [0.06, 0.15, 0.94, 0.85], n: Math.max(1, Math.round(t / 12)), dash: true, tone: 'dark' }] }),
};
export const PRESET_NAMES = Object.keys(PRESETS);

// Resolve a part or box: preset first, then the spec's own fields on top
// (its items and side are added to the preset's, never replace them).
export function resolve(o, w, d, t) {
  const pre = o.kind && PRESETS[o.kind] ? PRESETS[o.kind](w, d, t) : {};
  return {
    hollow: o.hollow ?? pre.hollow,
    rings: o.rings ?? pre.rings,
    r: o.r ?? pre.r,
    top: o.top ?? pre.top,
    topH: o.topH ?? pre.topH,
    // a preset's top-face items assume its own top; a roof or dome replaces them
    items: [...(o.top && !pre.top ? [] : pre.items || []), ...(o.items || [])],
    side: [...(pre.side || []), ...(o.side || [])],
  };
}

export const DETAIL_CSS = `
.it-light .iso-base{fill:var(--sc-node)}
.it-dark .iso-base,.it-black .iso-base{fill:var(--sc-ax-screen)}
.it-dark .iso-t,.it-black .iso-t{fill:#fff;fill-opacity:.07}
.it-dark .iso-edge,.it-black .iso-edge{stroke:#fff;stroke-opacity:.18}
.it-accent .iso-base{fill:var(--sc-node)}.it-accent .iso-t,.it-accent .iso-l,.it-accent .iso-r{fill:var(--sc-accent)}
.it-accent .iso-t{fill-opacity:.25}.it-accent .iso-l{fill-opacity:.4}.it-accent .iso-r{fill-opacity:.55}
.it-accent .iso-sil{stroke:var(--sc-accent)}
.it-mid .iso-base{fill:var(--sc-node)}
.it-solid .iso-sil{stroke-width:.9}
path.it-dark{fill:var(--sc-ax-screen)}
path.it-black{fill:#000;fill-opacity:.85}
/* dark panels and solids keep an edge where they sit on dark walls (dark themes) */
path.it-dark,path.it-black{stroke:var(--sc-ax-dark-edge);stroke-width:.7}
.it-dark .iso-sil,.it-black .iso-sil{stroke:var(--sc-ink)}
path.it-line.it-stroke-dark{stroke:var(--sc-ax-screen);stroke-opacity:.8}
path.it-light{fill:var(--sc-node);stroke:var(--sc-ink);stroke-opacity:.45;stroke-width:.6}
path.it-accent{fill:var(--sc-accent);fill-opacity:.9}
path.it-mid{fill:var(--sc-ink);fill-opacity:.08}
path.it-cut{fill:var(--sc-ink);fill-opacity:.13;stroke:var(--sc-ink);stroke-opacity:.45;stroke-width:.5}
path.it-line{fill:none;stroke:var(--sc-ink);stroke-opacity:.5;stroke-width:.8;stroke-linecap:round}
path.it-text{fill:none;stroke:var(--sc-ink);stroke-opacity:.35;stroke-width:1.4;stroke-linecap:round}
path.it-line.it-stroke-accent,path.it-text.it-stroke-accent{stroke:var(--sc-accent);stroke-opacity:1}
path.it-stroke-light{stroke:#fff;stroke-opacity:.7}
path.it-line.it-stroke-dark{stroke-width:2.2}
path.it-dash{stroke-dasharray:4 3}
path.it-button{fill:var(--sc-node);stroke:var(--sc-ink);stroke-opacity:.6;stroke-width:.8}
path.it-cavity{fill:var(--sc-ink);fill-opacity:.07}
path.it-floor{fill:var(--sc-ink);fill-opacity:.04;stroke:var(--sc-ink);stroke-opacity:.35;stroke-width:.7}
`;
