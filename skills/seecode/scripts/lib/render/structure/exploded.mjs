// Exploded view: the parts of one thing, drawn isometric and lifted apart
// along one vertical axis, each labelled in a column on the right. Parts are
// listed bottom to top; parts that sit side by side share a `level` and lift
// together. Motion opens on the assembled object and explodes it once.
import { el, text } from '../../svg.mjs';
import { textWidth } from '../../text.mjs';
import { item } from './common.mjs';
import { iso, prism, flat, outline } from './axon.mjs';
import { dressedSolid, resolve, inset as insetRect } from './iso-detail.mjs';

export const family = 'structure';

const DEF = { w: 240, d: 160, t: 14, r: 10 };
const NAME = { size: 14, weight: 600 };
const SUBF = { size: 9.5, mono: true, tracking: 0.06 };
const LABEL_GAP = 36; // minimum vertical distance between two labels
const OVERLAP = 8; // how far (px) one level's part may overlap another's

// How deep two convex outlines overlap (0 when apart): the smallest
// projection overlap over every edge normal of both (separating axes).
function overlapDepth(a, b) {
  let depth = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q.y - p.y, ny = p.x - q.x, len = Math.hypot(nx, ny) || 1;
      const proj = (pts) => pts.map((v) => (v.x * nx + v.y * ny) / len);
      const pa = proj(a), pb = proj(b);
      const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (o <= 0) return 0;
      depth = Math.min(depth, o);
    }
  }
  return depth;
}

// the height of the tallest raised item on a part (a camera bump, keycaps)
function tallest(p) {
  const walk = (items = []) => Math.max(0, ...items.map((it) => (it.h || 0) + (it.top ? it.topH ?? 12 : 0) + walk(it.items)));
  const cap = p.res.top ? p.res.topH ?? Math.min(p.w, p.d) * 0.35 : 0;
  return cap + walk(p.res.items);
}
const up4 = (v) => Math.ceil(v / 4) * 4;

export function render(spec) {
  const problems = [];
  const parts = spec.parts.map((p, i) => {
    const o = item(p, i, 'p');
    const w = o.w ?? spec.w ?? DEF.w, d = o.d ?? spec.d ?? DEF.d, t = o.t ?? DEF.t;
    const cx = o.x ?? 0, cy = o.y ?? 0;
    const res = resolve(o, w, d, t);
    const rr = res.r === 'round' ? Math.min(w, d) / 2 : Math.min(res.r ?? DEF.r, w / 2, d / 2);
    return {
      ...o, w, d, t, res, level: o.level ?? i,
      rect: { x0: cx - w / 2, y0: cy - d / 2, x1: cx + w / 2, y1: cy + d / 2, r: rr },
    };
  });
  const ids = new Set();
  for (const p of parts) {
    if (ids.has(p.id)) problems.push({ code: 'E_DUP_ID', at: `parts.${p.id}`, msg: `duplicate id "${p.id}"`, fix: 'ids must be unique' });
    ids.add(p.id);
  }
  if (problems.length) return { problems };
  if (parts.length > 6) problems.push({ code: 'W_BUDGET', at: 'parts', msg: `${parts.length} parts`, fix: 'keep 2–6 parts; merge small ones or put side-by-side parts on one level' });
  if (parts.filter((p) => p.focal).length > 1) problems.push({ code: 'W_FOCAL', at: 'parts', msg: 'more than one focal part', fix: 'keep the accent on one part' });

  // levels, bottom to top, each as thick as its thickest part
  const levelKeys = [...new Set(parts.map((p) => p.level))].sort((a, b) => a - b);
  const L = levelKeys.length;
  const levelOf = (p) => levelKeys.indexOf(p.level);
  const thick = levelKeys.map((k) => Math.max(...parts.filter((p) => p.level === k).map((p) => p.t)));
  // one even gap: half the largest top face, or three times the thickest part
  const faceH = Math.max(...parts.map((p) => (p.w + p.d) / 2));
  let gap = spec.gap ?? up4(Math.max(0.5 * faceH, 3 * Math.max(...thick)));
  const zAt = (g) => { const z = [0]; for (let k = 1; k < L; k++) z.push(z[k - 1] + thick[k - 1] + g); return z; };
  const closed = zAt(0);
  // the screen point each part's leader starts from: its right extreme at mid-thickness
  const anchor = (p, z) => {
    const o = outline(p.rect).reduce((m, q) => (q.x - q.y > m.x - m.y ? q : m));
    return iso(o.x, o.y, z[levelOf(p)] + p.t / 2);
  };
  // raise the gap until labels of different levels are LABEL_GAP apart and
  // no part covers a part on another level (a little overlap is allowed)
  const silAt = (p, zz) => prism(p.rect, zz[levelOf(p)], p.t + tallest(p), { silhouette: true }).sil;
  let z = zAt(gap);
  for (let guard = 0; spec.gap === undefined && guard < 200; guard++) {
    const ys = parts.map((p) => ({ k: levelOf(p), y: anchor(p, z).y }));
    const tight = ys.some((a, i) => ys.some((b, j) => j > i && a.k !== b.k && Math.abs(a.y - b.y) < LABEL_GAP));
    const sils = parts.map((p) => ({ k: levelOf(p), s: silAt(p, z) }));
    const covered = sils.some((a, i) => sils.some((b, j) => j > i && a.k !== b.k && overlapDepth(a.s, b.s) > OVERLAP));
    if (!tight && !covered) break;
    gap += 4;
    z = zAt(gap);
  }
  // parts on one level are labelled at their own heights; warn if they crowd
  for (const k of levelKeys) {
    const same = parts.filter((p) => p.level === k).map((p) => ({ p, y: anchor(p, z).y })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < same.length; i++) {
      if (same[i].y - same[i - 1].y < LABEL_GAP) problems.push({ code: 'W_EXPLODED_LABELS', at: `parts.${same[i].p.id}`, msg: `"${same[i - 1].p.label}" and "${same[i].p.label}" are labelled too close together`, fix: `move one of them in plan (x/y) so their right ends differ more, or give it its own level` });
    }
  }

  // step: the top level lifts first; the bottom level never moves
  const stepOf = (p) => Math.min(12, L - levelOf(p));
  const drawn = parts.map((p) => {
    const k = levelOf(p);
    const ds = dressedSolid({ rect: p.rect, t: p.t, ...p.res }, z[k]);
    const solid = { svg: ds.back, sil: ds.sil, top: ds.top, front: ds.front, wall: ds.wall };
    const extras = [];
    return { p, k, solid, extras, a: anchor(p, z), lift: Math.round(z[k] - closed[k]) };
  });

  // label column right of everything
  const silX = Math.max(...drawn.map((d) => Math.max(...d.solid.sil.map((q) => q.x))));
  const colX = silX + 48;
  const labelW = Math.max(...parts.map((p) => Math.max(textWidth(p.label, NAME), p.sub ? textWidth(p.sub, SUBF) : 0)));

  // trace lines up through the bottom part's left and right extremes
  const out = [];
  const bottom = drawn.filter((d) => d.k === 0);
  const topZ = z[L - 1];
  if (L > 1) {
    const sil = bottom.flatMap((d) => d.solid.sil);
    const lx = Math.min(...sil.map((q) => q.x)), rx = Math.max(...sil.map((q) => q.x));
    const at = (x) => sil.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m));
    const traces = [lx, rx].map((x) => { const q = at(x); return el('path', { class: 'iso-trace', d: `M${q.x},${q.y} L${q.x},${q.y - topZ}` }); });
    out.push(el('g', { class: 'iso-traces sc-fade', 'data-role': 'trace', 'data-sc-step': Math.min(12, L), style: `--step:${Math.min(12, L)}` }, traces));
  }

  // paint: bottom level first; inside a level, parts farther back first
  const order = [...drawn].sort((a, b) => a.k - b.k || (a.p.rect.x0 + a.p.rect.y0) - (b.p.rect.x0 + b.p.rect.y0));
  // a tray's front walls and rim paint after the parts that sit inside it
  const trays = order.filter((d) => d.solid.front);
  const inside = (t, d) => {
    const ir = insetRect(t.p.rect, t.solid.wall), r = d.p.rect;
    return d.k > t.k && r.x0 >= ir.x0 - 0.5 && r.y0 >= ir.y0 - 0.5 && r.x1 <= ir.x1 + 0.5 && r.y1 <= ir.y1 + 0.5;
  };
  const frontAfter = new Map(trays.map((t) => {
    const within = order.filter((d) => inside(t, d));
    return [t, within.length ? within[within.length - 1] : t];
  }));
  const trayFrontGroup = (t) => {
    const st = stepOf(t.p);
    return el('g', { class: `iso-part iso-front ${t.p.focal ? 'k-focal' : 'k-backend'}${t.lift ? ' sc-lift' : ''}`, 'data-sc-step': st, style: `--step:${st};--lift:${t.lift}px`, 'aria-hidden': 'true' }, t.solid.front);
  };
  for (const d of order) {
    const st = stepOf(d.p);
    out.push(el('g', {
      class: `sc-node iso-part ${d.p.focal ? 'k-focal' : 'k-backend'}${d.lift ? ' sc-lift' : ''}`,
      'data-sc-node': d.p.id,
      'data-sc-step': st,
      'data-level': d.k,
      style: `--step:${st};--lift:${d.lift}px`,
      tabindex: 0,
      role: 'group',
      'aria-label': [d.p.label, d.p.sub].filter(Boolean).join(', '),
    }, [d.solid.svg, ...d.extras]));
    for (const t of trays) if (frontAfter.get(t) === d) out.push(trayFrontGroup(t));
  }
  // labels paint last so no part covers them; each fades in once its part settles
  for (const d of order) {
    const st = stepOf(d.p);
    const y = d.a.y;
    const parts2 = [
      el('circle', { class: 'iso-dot', cx: d.a.x, cy: y, r: 2 }),
      el('line', { class: 'iso-leader', 'data-role': 'leader', x1: d.a.x + 6, y1: y, x2: colX - 12, y2: y }),
      text({ class: 'iso-name', 'data-role': 'name', x: colX, y: d.p.sub ? y - 2 : y + 5 }, d.p.label),
    ];
    if (d.p.sub) parts2.push(text({ class: 'iso-sub', x: colX, y: y + 12 }, d.p.sub.toUpperCase()));
    out.push(el('g', { class: `iso-label ${d.p.focal ? 'k-focal' : 'k-backend'}`, 'data-sc-step': st, style: `--step:${st}`, 'aria-hidden': 'true' }, parts2));
  }

  const all = drawn.flatMap((d) => d.solid.sil);
  const x0 = Math.min(...all.map((q) => q.x)) - 24;
  const y0 = Math.min(...all.map((q) => q.y), ...drawn.map((d) => d.a.y - 14)) - 24;
  const y1 = Math.max(...all.map((q) => q.y), ...drawn.map((d) => d.a.y + 16)) + 24;
  const x1 = colX + labelW + 24;
  return {
    body: el('g', { class: 'sc-nodes iso-exploded', 'data-gap': gap }, out),
    viewBox: [x0, y0, x1 - x0, y1 - y0],
    steps: Math.min(12, L),
    problems,
    graph: { nodes: parts.map((p) => ({ id: p.id, label: p.label })), edges: [] },
  };
}
