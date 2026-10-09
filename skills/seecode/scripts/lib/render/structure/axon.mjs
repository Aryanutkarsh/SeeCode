// Isometric (2:1 dimetric) drawing shared by the exploded and isometric-plan
// types. One projection places every point: model x runs right and down, y
// left and down, z up. Solids are rounded prisms: a footprint rectangle with
// corner radius r (0 = box, w/2 = cylinder), standing at height z, t tall.
// Faces are an opaque base plus a shade overlay, lit from the top left, so
// nothing behind ever shows through and the shape never reads as a wireframe.
import { el } from '../../svg.mjs';

export const iso = (x, y, z = 0) => ({ x: x - y, y: (x + y) / 2 - z });

const CORNER_STEPS = 6; // points per rounded corner (quarter circle)

// Footprint outline, counter-clockwise in model space, as {x, y, nx, ny}
// points; n is the outward normal of the edge that starts at the point.
export function outline({ x0, y0, x1, y1, r = 0 }) {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (!rr) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x, y }));
  const pts = [];
  // corners: centre and the start angle of their quarter arc
  const corners = [[x1 - rr, y0 + rr, -90], [x1 - rr, y1 - rr, 0], [x0 + rr, y1 - rr, 90], [x0 + rr, y0 + rr, 180]];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const a = ((a0 + (90 * k) / CORNER_STEPS) * Math.PI) / 180;
      pts.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
    }
  }
  return pts;
}

const P = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z';

// Convex hull (monotone chain) of projected points: the solid's silhouette.
function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// A rounded prism as SVG: shaded faces, inner edges and a silhouette.
// rect = {x0, y0, x1, y1, r} in model units; z = base height; t = thickness.
// Returns { svg, top, right } where top is the projected top outline and
// right the screen point of the solid's right extreme at mid-thickness.
export function prism(rect, z, t, { cls = '', silhouette = true } = {}) {
  const base = outline(rect);
  const n = base.length;
  const top = base.map((p) => iso(p.x, p.y, z + t));
  const bot = base.map((p) => iso(p.x, p.y, z));
  const parts = [];
  // side faces: an edge is visible when its outward normal points toward the
  // viewer (+x or +y). Normals facing more +y are the lit left face; more +x
  // the shaded right face. Runs of one kind merge into one polygon.
  const runs = [];
  for (let i = 0; i < n; i++) {
    const a = base[i], b = base[(i + 1) % n];
    const nx = b.y - a.y, ny = -(b.x - a.x); // outward for counter-clockwise order on screen-y-down
    if (nx + ny <= 1e-9) continue;
    const kind = ny >= nx ? 'l' : 'r';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind && last.end === i) { last.end = (i + 1) % n; last.idx.push((i + 1) % n); } else runs.push({ kind, start: i, end: (i + 1) % n, idx: [i, (i + 1) % n] });
  }
  for (const run of runs) {
    const pts = [...run.idx.map((k) => top[k]), ...[...run.idx].reverse().map((k) => bot[k])];
    parts.push(el('path', { class: 'iso-base', d: P(pts) }), el('path', { class: `iso-${run.kind}`, d: P(pts) }));
  }
  parts.push(el('path', { class: 'iso-base', d: P(top) }), el('path', { class: 'iso-t', d: P(top) }));
  // inner edges: the top outline, and the vertical edge where lit meets shade
  parts.push(el('path', { class: 'iso-edge', d: P(top) }));
  // (a box only: a rounded corner turns smoothly, so it has no edge)
  if (!rect.r) for (const run of runs) if (run.kind === 'l') {
    const k = run.idx[0];
    parts.push(el('path', { class: 'iso-edge', d: `M${top[k].x},${top[k].y} L${bot[k].x},${bot[k].y}` }));
  }
  const sil = hull([...top, ...bot]);
  if (silhouette) parts.push(el('path', { class: 'iso-sil', 'data-role': 'silhouette', d: P(sil) }));
  const right = sil.reduce((m, p) => (p.x > m.x ? p : m), sil[0]);
  return { svg: el('g', { class: `iso-solid${cls ? ` ${cls}` : ''}` }, parts), top, right, sil };
}

// A flat shape on a surface at height z (a screen, a road, a room floor).
export function flat(rect, z, cls) {
  return el('path', { class: cls, d: P(outline(rect).map((p) => iso(p.x, p.y, z))) });
}

// Screen bounds of a set of projected point lists.
export function screenBounds(pointLists) {
  const all = pointLists.flat();
  return {
    x0: Math.min(...all.map((p) => p.x)), x1: Math.max(...all.map((p) => p.x)),
    y0: Math.min(...all.map((p) => p.y)), y1: Math.max(...all.map((p) => p.y)),
  };
}

export const AXON_CSS = `
.iso-base{fill:var(--sc-node)}
.iso-t{fill:var(--sc-ax-lift);fill-opacity:var(--sc-ax-t-o)}
.iso-l{fill:var(--sc-ax-shade);fill-opacity:var(--sc-ax-l-o)}
.iso-r{fill:var(--sc-ax-shade);fill-opacity:var(--sc-ax-r-o)}
.k-focal .iso-t{fill:var(--sc-accent);fill-opacity:.12}
.k-focal .iso-l{fill:var(--sc-accent);fill-opacity:.22}
.k-focal .iso-r{fill:var(--sc-accent);fill-opacity:.34}
.iso-edge{fill:none;stroke:var(--sc-ink);stroke-opacity:.5;stroke-width:.8;stroke-linejoin:round}
.iso-sil{fill:none;stroke:var(--sc-ink);stroke-width:1.2;stroke-linejoin:round}
.k-focal .iso-sil{stroke:var(--sc-accent)}
.iso-inset{fill:var(--sc-ink);fill-opacity:.06;stroke:var(--sc-ink);stroke-opacity:.5;stroke-width:.7}
.k-focal .iso-inset{fill:var(--sc-accent);fill-opacity:.16;stroke:var(--sc-accent)}
.iso-trace{fill:none;stroke:var(--sc-ink);stroke-opacity:.3;stroke-width:.8;stroke-dasharray:4 3}
.iso-leader{stroke:var(--sc-ink);stroke-opacity:.4;stroke-width:.8}
.iso-dot{fill:var(--sc-ink)}
.k-focal .iso-leader{stroke:var(--sc-accent);stroke-opacity:1}.k-focal .iso-dot{fill:var(--sc-accent)}
.iso-name{fill:var(--sc-ink);font-size:14px;font-weight:600}
.iso-sub{fill:var(--sc-muted);font-family:var(--sc-font-mono);font-size:9.5px;letter-spacing:.06em}
.k-focal .iso-sub{fill:var(--sc-accent)}
.iso-contour{fill:none;stroke:var(--sc-ink);stroke-opacity:.22;stroke-width:.7}
.iso-plate .iso-t{fill-opacity:0}
.iso-mark{fill:var(--sc-ink);fill-opacity:.07}
.iso-floor{fill:var(--sc-ink);fill-opacity:.035}
.k-focal .iso-floor,.iso-floor.k-focal{fill:var(--sc-accent);fill-opacity:.1}
.iso-canopy .iso-t{fill:var(--sc-series-1);fill-opacity:.55}
.iso-canopy .iso-l,.iso-canopy .iso-r{fill:var(--sc-series-1);fill-opacity:.35}
.iso-tag rect{fill:var(--sc-paper);stroke:var(--sc-rule-solid);stroke-width:.8}
.k-focal.iso-tag rect,.k-focal .iso-tag rect{stroke:var(--sc-accent)}
.iso-tag .iso-name{font-size:11px}.iso-tag .iso-sub{font-size:8px}
`;

// ---- shaped tops: domes and roofs -------------------------------------------

// A convex solid given as 3D faces (each a list of {x, y, z}, any winding).
// Faces turned toward the viewer (+x +y +z) are drawn, each shaded by the
// way it faces: mostly up = top tone, mostly +y = lit side, mostly +x = shade.
function solidFaces(faces, cls = '') {
  const all = faces.flat();
  const c = { x: all.reduce((s, p) => s + p.x, 0) / all.length, y: all.reduce((s, p) => s + p.y, 0) / all.length, z: all.reduce((s, p) => s + p.z, 0) / all.length };
  const out = [];
  for (const f of faces) {
    if (f.length < 3) continue;
    if (f.tone) { // already shaded and known to face the viewer
      const pts = f.map((p) => iso(p.x, p.y, p.z));
      const d2 = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z';
      out.push(el('path', { class: 'iso-base iso-facet', d: d2 }), el('path', { class: `iso-${f.tone} iso-facet`, d: d2 }));
      continue;
    }
    const [a, b, d] = [f[0], f[1], f[2]];
    let n = { x: (b.y - a.y) * (d.z - a.z) - (b.z - a.z) * (d.y - a.y), y: (b.z - a.z) * (d.x - a.x) - (b.x - a.x) * (d.z - a.z), z: (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x) };
    const len = Math.hypot(n.x, n.y, n.z);
    if (len < 1e-9) continue;
    const m = { x: f.reduce((s, p) => s + p.x, 0) / f.length - c.x, y: f.reduce((s, p) => s + p.y, 0) / f.length - c.y, z: f.reduce((s, p) => s + p.z, 0) / f.length - c.z };
    if (n.x * m.x + n.y * m.y + n.z * m.z < 0) n = { x: -n.x, y: -n.y, z: -n.z }; // outward
    if (n.x + n.y + n.z <= 1e-9) continue; // faces away from the viewer
    // light from the top left: up is brightest, +y lit, +x in shade
    const lum = (0.1 * n.x + 0.55 * n.y + 0.83 * n.z) / len;
    const tone = lum > 0.78 ? "t" : lum > 0.36 ? "l" : "r";
    const pts = f.map((p) => iso(p.x, p.y, p.z));
    const d2 = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z';
    // planar facets (roofs) show their edges; curved strips (domes) do not
    out.push(el('path', { class: 'iso-base iso-facet', d: d2 }), el('path', { class: `iso-${tone} iso-facet`, d: d2 }), el('path', { class: 'iso-edge', d: d2 }));
  }
  const sil = hull(faces.flat().map((p) => iso(p.x, p.y, p.z)));
  out.push(el('path', { class: 'iso-sil', 'data-role': 'silhouette', d: P(sil) }));
  return { svg: el('g', { class: `iso-solid${cls ? ` ${cls}` : ''}` }, out), sil };
}

// The cap of a shaped top standing on the face `rect` at height z, `h` tall:
//   dome   rounded cap over the footprint (a bun, a dome, a pillow, a lens)
//   gable  pitched roof, ridge along the long side
//   hip    roof sloping on all four sides to a ridge or a point (a pyramid)
//   shed   one slope rising toward the back
export function capFaces(rect, z, h, shape) {
  const { x0, y0, x1, y1 } = rect;
  const v = (x, y, zz) => ({ x, y, z: zz });
  const w = x1 - x0, d = y1 - y0;
  if (shape === 'dome') {
    const R = Math.min(w, d) / 2;
    const n = 7;
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const th = (k / n) * (Math.PI / 2);
      const m = Math.min(R * (1 - Math.cos(th)), R - 0.01);
      const r = { x0: x0 + m, y0: y0 + m, x1: x1 - m, y1: y1 - m, r: Math.max(0.01, (rect.r || 0) - m) };
      rings.push(outlineFixed(r).map((p) => v(p.x, p.y, z + h * Math.sin(th))));
    }
    // one face per band and tone: neighbouring facets that would shade the
    // same are merged into one strip, which keeps a dome to a few paths
    const faces = [Object.assign([...rings[n]], { tone: 't' })];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let k = 0; k < n; k++) {
      const N = rings[k].length;
      const toneAt = (i) => {
        // the band's normal: outward in plan, tilting up toward the top
        const a = rings[k][i], b = rings[k][(i + 1) % N];
        const ex = b.x - a.x, ey = b.y - a.y, el2 = Math.hypot(ex, ey) || 1;
        const ox = ey / el2, oy = -ex / el2; // outward in plan (counter-clockwise outline)
        const th = ((k + 0.5) / n) * (Math.PI / 2);
        const nx = ox * Math.cos(th), ny = oy * Math.cos(th), nz = Math.sin(th);
        if (nx + ny + nz <= 1e-6) return null; // faces away
        const lum = 0.1 * nx + 0.55 * ny + 0.83 * nz;
        return lum > 0.78 ? 't' : lum > 0.36 ? 'l' : 'r';
      };
      let i = 0;
      while (i < N) {
        const t = toneAt(i);
        if (!t) { i++; continue; }
        let j = i;
        while (j + 1 < N && toneAt(j + 1) === t) j++;
        const bottom = rings[k].slice(i, j + 2 > N ? N : j + 2);
        if (j + 1 >= N) bottom.push(rings[k][0]);
        const top = rings[k + 1].slice(i, j + 2 > N ? N : j + 2);
        if (j + 1 >= N) top.push(rings[k + 1][0]);
        faces.push(Object.assign([...bottom, ...top.reverse()], { tone: t }));
        i = j + 1;
      }
    }
    return faces;
  }
  const along = w >= d; // ridge along the longer side
  if (shape === 'gable') {
    const r0 = along ? [v(x0, (y0 + y1) / 2, z + h), v(x1, (y0 + y1) / 2, z + h)] : [v((x0 + x1) / 2, y0, z + h), v((x0 + x1) / 2, y1, z + h)];
    return along
      ? [[v(x0, y0, z), v(x1, y0, z), r0[1], r0[0]], [v(x0, y1, z), v(x1, y1, z), r0[1], r0[0]], [v(x0, y0, z), v(x0, y1, z), r0[0]], [v(x1, y0, z), v(x1, y1, z), r0[1]]]
      : [[v(x0, y0, z), v(x0, y1, z), r0[1], r0[0]], [v(x1, y0, z), v(x1, y1, z), r0[1], r0[0]], [v(x0, y0, z), v(x1, y0, z), r0[0]], [v(x0, y1, z), v(x1, y1, z), r0[1]]];
  }
  if (shape === 'hip') {
    const inset = Math.min(w, d) / 2;
    const a = along ? v(x0 + inset, (y0 + y1) / 2, z + h) : v((x0 + x1) / 2, y0 + inset, z + h);
    const b = along ? v(x1 - inset, (y0 + y1) / 2, z + h) : v((x0 + x1) / 2, y1 - inset, z + h);
    const c00 = v(x0, y0, z), c10 = v(x1, y0, z), c11 = v(x1, y1, z), c01 = v(x0, y1, z);
    return along
      ? [[c00, c10, b, a], [c01, c11, b, a], [c00, c01, a], [c10, c11, b]]
      : [[c00, c01, b, a], [c10, c11, b, a], [c00, c10, a], [c01, c11, b]];
  }
  if (shape === 'shed') {
    // high at the back (y0 side), low at the front
    return [[v(x0, y0, z + h), v(x1, y0, z + h), v(x1, y1, z), v(x0, y1, z)], [v(x0, y0, z), v(x0, y0, z + h), v(x0, y1, z)], [v(x1, y0, z), v(x1, y0, z + h), v(x1, y1, z)], [v(x0, y0, z), v(x1, y0, z), v(x1, y0, z + h), v(x0, y0, z + h)]];
  }
  return [];
}

// a rounded-rectangle outline that always has the same number of points
// (a radius of ~0 repeats corner points), so dome rings line up
function outlineFixed(r) {
  return outline({ ...r, r: Math.max(r.r || 0, 1e-3) });
}

export function cap(rect, z, h, shape, cls = '') {
  const faces = capFaces(rect, z, h, shape);
  if (!faces.length) return null;
  const solid = solidFaces(faces, cls);
  if (shape === 'dome') {
    // faint contour lines across the front of the dome show its curve
    const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
    const R = Math.min(rect.x1 - rect.x0, rect.y1 - rect.y0) / 2;
    const lines = [];
    for (const th of [0.32, 0.62, 0.92]) {
      const m = Math.min(R * (1 - Math.cos(th)), R - 0.01);
      const ring = outline({ x0: rect.x0 + m, y0: rect.y0 + m, x1: rect.x1 - m, y1: rect.y1 - m, r: Math.max(0.01, (rect.r || 0) - m) });
      const n = ring.length;
      const vis = ring.map((p) => (p.x - cx) + (p.y - cy) >= 0);
      let s0 = vis.findIndex((v, i) => v && !vis[(i - 1 + n) % n]);
      if (s0 < 0) continue;
      const pts = [];
      for (let k = 0; k < n && vis[(s0 + k) % n]; k++) { const p = ring[(s0 + k) % n]; pts.push(iso(p.x, p.y, z + h * Math.sin(th))); }
      if (pts.length > 1) lines.push(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
    }
    if (lines.length) solid.svg = solid.svg.replace(/<\/g>$/, `${el('path', { class: 'iso-contour', d: lines.join(' ') })}</g>`);
  }
  return solid;
}

// A solid with a shaped top: its walls (a plain prism t tall), then the cap.
export function cappedPrism(rect, z, t, top, topH, opts = {}) {
  const body = t > 0 ? prism(rect, z, t, opts) : null;
  const c = cap(top === 'dome' ? rect : { ...rect, r: 0 }, z + t, topH, top, opts.cls);
  const sil = hull([...(body ? body.sil : []), ...(c ? c.sil : [])]);
  const right = sil.reduce((m, p) => (p.x > m.x ? p : m), sil[0]);
  return { svg: (body ? body.svg : '') + (c ? c.svg : ''), sil, top: body ? body.top : [], right };
}

// Height of a shaped top above its base at plan point (x, y), so flat items
// can lie on a dome or a roof instead of floating at the eaves.
export function capHeight(rect, h, shape) {
  const { x0, y0, x1, y1 } = rect;
  const w = x1 - x0, d = y1 - y0;
  return (x, y) => {
    const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y1 - y);
    if (shape === 'dome') {
      const R = Math.min(w, d) / 2;
      // inside distance to the rounded-rectangle edge (radial at the corners)
      const rr = Math.min(rect.r || 0, R);
      const qx = Math.abs(x - (x0 + x1) / 2) - (w / 2 - rr), qy = Math.abs(y - (y0 + y1) / 2) - (d / 2 - rr);
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
      const m = Math.max(0, Math.min(-sd, R));
      return h * Math.sin(Math.acos(Math.max(-1, Math.min(1, 1 - m / R))));
    }
    if (shape === 'gable') return w >= d ? h * Math.max(0, dy) / (d / 2) : h * Math.max(0, dx) / (w / 2);
    if (shape === 'hip') { const half = Math.min(w, d) / 2; return h * Math.max(0, Math.min(dx, dy)) / half; }
    if (shape === 'shed') return h * (1 - (y - y0) / d);
    return 0;
  };
}
