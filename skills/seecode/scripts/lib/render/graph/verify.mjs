// Geometry checks on finished routes. The router aims for these already;
// this pass catches what it could not achieve so the author can move nodes:
// diagonal runs, two connectors stacked on one line, ports crowded on one
// side, and connectors that ride along a box border.

const EPS = 0.75; // coordinates are rounded to 0.5px
const RUN = 4; // shared or border-riding length that becomes visible
const PORT_GAP = 12; // ports on one side keep this far apart…
const PORT_GAP_SHORT = 8; // …or this on a side shorter than 48px
const POINT = new Set(['decision', 'start', 'end']);
const CORNER = 6; // the box corner radius: a port closer than this sits on the curve

function segments(e) {
  const p = e.route, out = [];
  for (let i = 1; i < p.length; i++) out.push({ a: p[i - 1], b: p[i], first: i === 1, last: i === p.length - 1 });
  return out;
}

// collinear overlap length of two axis-aligned segments (0 if not collinear)
function overlap(s, t) {
  const sv = Math.abs(s.a.x - s.b.x) < EPS, tv = Math.abs(t.a.x - t.b.x) < EPS;
  const sh = Math.abs(s.a.y - s.b.y) < EPS, th = Math.abs(t.a.y - t.b.y) < EPS;
  if (sv && tv && Math.abs(s.a.x - t.a.x) < EPS) return span(s.a.y, s.b.y, t.a.y, t.b.y);
  if (sh && th && Math.abs(s.a.y - t.a.y) < EPS) return span(s.a.x, s.b.x, t.a.x, t.b.x);
  return 0;
}

function span(a0, a1, b0, b1) {
  return Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
}

const name = (e) => `${e.from}→${e.to}`;
const flip = (s) => ({ a: s.b, b: s.a });

// How many leading segments two routes share as one trunk: identical
// segments, plus the segment where they part (same start, same direction).
// Used on reversed routes to find where edges merge into a shared target.
function trunk(as, bs) {
  let k = 0;
  const same = (p, q) => Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
  while (k < as.length && k < bs.length && same(as[k].a, bs[k].a) && same(as[k].b, bs[k].b)) k++;
  if (k < as.length && k < bs.length && same(as[k].a, bs[k].a) && overlap(as[k], bs[k]) > 0) k++;
  return k;
}

export function checkRoutes(nodes, edges) {
  const problems = [];
  const routed = edges.filter((e) => e.route && e.route.length > 1 && e.from !== e.to);

  // 1. every run is horizontal or vertical
  for (const e of routed) {
    if (segments(e).some((s) => Math.abs(s.a.x - s.b.x) >= EPS && Math.abs(s.a.y - s.b.y) >= EPS)) {
      problems.push({ code: 'W_ROUTE_DIAGONAL', at: `edges.${e.id}`, msg: `${name(e)} has a diagonal run`, fix: `put "${e.from}" and "${e.to}" in the same row or col, or one row/col apart` });
    }
  }

  // 2. two connectors stacked on one line read as one. Edges from one source
  // fan out along a shared bus on purpose (the router merges them), so they
  // may overlap anywhere; edges into one target may share only the final
  // stretch where they merge into it.
  const segs = routed.map((e) => ({ e, s: segments(e) }));
  const stacked = new Set();
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j];
      let as = A.s, bs = B.s;
      if (A.e.from === B.e.from) continue;
      if (A.e.to === B.e.to) {
        const k = trunk([...as].reverse().map(flip), [...bs].reverse().map(flip));
        as = as.slice(0, as.length - k); bs = bs.slice(0, bs.length - k);
      }
      const len = Math.max(0, ...as.flatMap((s) => bs.map((t) => overlap(s, t))));
      if (len <= RUN) continue;
      const key = [A.e.id, B.e.id].sort().join('|');
      if (stacked.has(key)) continue;
      stacked.add(key);
      problems.push({ code: 'W_ROUTE_STACKED', at: `edges.${B.e.id}`, msg: `${name(A.e)} and ${name(B.e)} share ${Math.round(len)}px of one line`, fix: `move "${B.e.from}" or "${B.e.to}" one row/col so the two paths separate` });
    }
  }

  // 3b. a port in a box's rounded corner looks detached from the box
  for (const e of routed) {
    for (const [id, side, p] of [[e.from, e.sS, e.route[0]], [e.to, e.sT, e.route[e.route.length - 1]]]) {
      const n = nodes.find((m) => m.id === id);
      if (!n || !side || POINT.has(n.shape)) continue;
      const [lo, len, v] = side === 'L' || side === 'R' ? [n.y, n.h, p.y] : [n.x, n.w, p.x];
      const gap = Math.min(v - lo, lo + len - v);
      if (gap >= CORNER - EPS) continue;
      problems.push({ code: 'W_ROUTE_CORNER', at: `edges.${e.id}`, msg: `${name(e)} meets "${id}" ${Math.max(0, Math.round(gap))}px from its corner`, fix: `give "${id}" fewer connectors on that side, or move the other end so the line meets the side nearer its middle` });
    }
  }

  // 3. ports on one side of a node keep apart (decision/start/end shapes use
  // one center port by design)
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ports = new Map();
  for (const e of routed) {
    for (const [id, side, p] of [[e.from, e.sS, e.route[0]], [e.to, e.sT, e.route[e.route.length - 1]]]) {
      const n = byId.get(id);
      if (!n || !side || POINT.has(n.shape)) continue;
      const key = `${id}:${side}`;
      if (!ports.has(key)) ports.set(key, []);
      ports.get(key).push({ e, v: side === 'L' || side === 'R' ? p.y : p.x });
    }
  }
  for (const [key, list] of ports) {
    if (list.length < 2) continue;
    const [id, side] = key.split(':');
    const n = byId.get(id);
    const len = side === 'L' || side === 'R' ? n.h : n.w;
    const need = len < 48 ? PORT_GAP_SHORT : PORT_GAP;
    list.sort((a, b) => a.v - b.v);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i].v - list[i - 1].v;
      if (gap >= need - EPS) continue;
      const where = { L: 'left', R: 'right', T: 'top', B: 'bottom' }[side];
      problems.push({ code: 'W_ROUTE_PORTS', at: `nodes.${id}`, msg: `${list.length} connectors crowd the ${where} side of "${id}" (${Math.round(gap)}px apart, want ${need})`, fix: `move one of ${list.map((x) => `"${x.e.from === id ? x.e.to : x.e.from}"`).join(', ')} to another side of "${id}", or give "${id}" a longer label (wider box)` });
      break;
    }
  }

  // 4. a connector must not ride along a box border (it reads as part of the box)
  for (const e of routed) {
    for (const s of segments(e)) {
      for (const n of nodes) {
        const edgesOfBox = [
          { a: { x: n.x, y: n.y }, b: { x: n.x + n.w, y: n.y } },
          { a: { x: n.x, y: n.y + n.h }, b: { x: n.x + n.w, y: n.y + n.h } },
          { a: { x: n.x, y: n.y }, b: { x: n.x, y: n.y + n.h } },
          { a: { x: n.x + n.w, y: n.y }, b: { x: n.x + n.w, y: n.y + n.h } },
        ];
        if (!edgesOfBox.some((b) => overlap(s, b) > RUN)) continue;
        problems.push({ code: 'W_ROUTE_BORDER', at: `edges.${e.id}`, msg: `${name(e)} runs along the border of "${n.id}"`, fix: `move "${n.id}" off the path between "${e.from}" and "${e.to}", or leave a free row/col between them` });
        break;
      }
    }
  }
  return dedupe(problems);
}

function dedupe(problems) {
  const seen = new Set();
  return problems.filter((p) => {
    const k = `${p.code}|${p.at}|${p.msg}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
