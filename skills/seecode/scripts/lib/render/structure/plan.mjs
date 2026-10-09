// Isometric plan: one floor or one site seen from above at an angle, with
// what stands on it. A plate; flat marks on it (roads, paths, tints); rooms
// (a tinted floor, optional low walls with a door gap); and boxes standing on
// it (furniture, buildings, racks, trees). Rooms and named boxes carry a
// horizontal tag. Boxes paint back to front by a topological sort, so long
// walls never cover what stands in front of them. Optional `step` phases
// reveal a site in the order it was built.
import { el, text } from '../../svg.mjs';
import { textWidth } from '../../text.mjs';
import { iso, prism, flat } from './axon.mjs';
import { dressedSolid, resolve } from './iso-detail.mjs';

export const family = 'structure';

const WALL_T = 6, WALL_H = 22, DOOR = 28;
const DEF_H = { furniture: 12, building: 44, rack: 52, tree: 26, wall: WALL_H };
const NAME = { size: 11, weight: 600 };
const SUBF = { size: 8, mono: true, tracking: 0.06 };

const rectOf = (o) => ({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.d });
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// low walls inside a room's edges, with a door gap centred on each side named
// in `door` ("S" = the front edge at max y, "E" = max x, "N", "W")
function roomWalls(room) {
  const { x0, y0, x1, y1 } = rectOf(room);
  const doors = new Set([].concat(room.door || []).map((d) => String(d).toUpperCase()));
  const out = [];
  const run = (side, a0, a1, mk) => {
    if (!doors.has(side) || a1 - a0 < DOOR + 2 * WALL_T) { out.push(mk(a0, a1)); return; }
    const mid = (a0 + a1) / 2;
    out.push(mk(a0, mid - DOOR / 2), mk(mid + DOOR / 2, a1));
  };
  const tagged = (side, mk) => (a, b) => ({ ...mk(a, b), side });
  run('N', x0, x1, tagged('N', (a, b) => ({ x0: a, y0, x1: b, y1: y0 + WALL_T })));
  run('S', x0, x1, tagged('S', (a, b) => ({ x0: a, y0: y1 - WALL_T, x1: b, y1 })));
  // side walls run the full depth when the end wall is skipped for a neighbour
  run('W', y0, y1, tagged('W', (a, b) => ({ x0, y0: a, x1: x0 + WALL_T, y1: b })));
  run('E', y0, y1, tagged('E', (a, b) => ({ x0: x1 - WALL_T, y0: a, x1, y1: b })));
  return out.filter((r) => r.x1 - r.x0 > 0.5 && r.y1 - r.y0 > 0.5).map(({ side, ...r }, i) => ({ id: `${room.id}-wall${i}`, kind: 'wall', side, rect: { ...r, r: 0 }, z: 0, h: WALL_H, room: room.id }));
}

// Rooms that touch share one wall: where a later room's side lies on an
// earlier room's side, the later room skips that wall, and its door on that
// side is cut into the earlier room's wall instead.
function sharedWalls(rooms) {
  const out = [];
  const sides = (r) => {
    const { x0, y0, x1, y1 } = rectOf(r);
    return { N: { axis: 'y', at: y0, a0: x0, a1: x1 }, S: { axis: 'y', at: y1, a0: x0, a1: x1 }, W: { axis: 'x', at: x0, a0: y0, a1: y1 }, E: { axis: 'x', at: x1, a0: y0, a1: y1 } };
  };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  rooms.forEach((room, i) => {
    const mine = sides(room);
    const skip = new Set();
    for (const [side, s] of Object.entries(mine)) {
      for (const other of rooms.slice(0, i)) {
        const o = sides(other)[OPP[side]];
        const shared = Math.min(s.a1, o.a1) - Math.max(s.a0, o.a0);
        if (Math.abs(o.at - s.at) > 0.5 || shared < 0.9 * (s.a1 - s.a0)) continue;
        skip.add(side);
        // this room's door on the shared side becomes a gap in the other's wall
        if ([].concat(room.door || []).map((d) => String(d).toUpperCase()).includes(side)) {
          const mid = (s.a0 + s.a1) / 2;
          other.cuts = [...(other.cuts || []), { axis: s.axis, at: s.at, a0: mid - DOOR / 2, a1: mid + DOOR / 2 }];
        }
        break;
      }
    }
    room.skip = skip;
  });
  for (const room of rooms) {
    let ws = roomWalls(room).filter((w) => !room.skip.has(w.side));
    for (const c of room.cuts || []) ws = ws.flatMap((w) => cut(w, c));
    out.push(...ws);
  }
  return out;
}

// removes the door interval c from wall w when they lie on the same edge
function cut(w, c) {
  const r = w.rect;
  const onLine = c.axis === 'x' ? Math.abs(r.x0 - c.at) <= WALL_T + 0.5 || Math.abs(r.x1 - c.at) <= WALL_T + 0.5 : Math.abs(r.y0 - c.at) <= WALL_T + 0.5 || Math.abs(r.y1 - c.at) <= WALL_T + 0.5;
  const [lo, hi] = c.axis === 'x' ? [r.y0, r.y1] : [r.x0, r.x1];
  const along = c.axis === 'x' ? r.x1 - r.x0 <= WALL_T + 0.5 : r.y1 - r.y0 <= WALL_T + 0.5;
  if (!onLine || !along || c.a1 <= lo || c.a0 >= hi) return [w];
  const parts = [[lo, Math.max(lo, c.a0)], [Math.min(hi, c.a1), hi]].filter(([a, b]) => b - a > 0.5);
  return parts.map(([a, b], k) => ({ ...w, id: `${w.id}-${k}`, rect: c.axis === 'x' ? { ...r, y0: a, y1: b } : { ...r, x0: a, x1: b } }));
}

// Back-to-front order: A paints before B when A lies wholly behind B and their
// screen outlines meet. Ties and unrelated boxes keep x + y order.
function paintOrder(boxes) {
  const n = boxes.length;
  const scr = boxes.map((b) => {
    const pts = [[b.rect.x0, b.rect.y0], [b.rect.x1, b.rect.y0], [b.rect.x1, b.rect.y1], [b.rect.x0, b.rect.y1]].flatMap(([x, y]) => [iso(x, y, b.z), iso(x, y, b.z + b.h + (b.capH || 0))]);
    return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
  });
  const after = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const A = boxes[i].rect, B = boxes[j].rect;
    const behind = A.x1 <= B.x0 + 1e-6 || A.y1 <= B.y0 + 1e-6;
    const meet = scr[i].x0 < scr[j].x1 && scr[j].x0 < scr[i].x1 && scr[i].y0 < scr[j].y1 && scr[j].y0 < scr[i].y1;
    if (behind && meet && !(B.x1 <= A.x0 + 1e-6 || B.y1 <= A.y0 + 1e-6)) { after[i].push(j); indeg[j]++; }
  }
  const key = (i) => boxes[i].rect.x0 + boxes[i].rect.y0 + boxes[i].z / 1000;
  const ready = [...Array(n).keys()].filter((i) => !indeg[i]);
  const out = [];
  while (ready.length) {
    ready.sort((a, b) => key(a) - key(b));
    const i = ready.shift();
    out.push(i);
    for (const j of after[i]) if (--indeg[j] === 0) ready.push(j);
  }
  // a cycle (boxes interlocking on screen) falls back to x + y for the rest
  const left = [...Array(n).keys()].filter((i) => !out.includes(i)).sort((a, b) => key(a) - key(b));
  return [...out, ...left].map((i) => boxes[i]);
}

function tag(label, sub, at, { focal, step, id }) {
  const w = Math.ceil((Math.max(textWidth(label, NAME), sub ? textWidth(sub.toUpperCase(), SUBF) : 0) + 16) / 4) * 4;
  const h = sub ? 30 : 20;
  const x = at.x - w / 2, y = at.y - h / 2;
  const parts = [el('rect', { x, y, width: w, height: h, rx: 3 }), text({ class: 'iso-name', 'data-role': 'name', x: at.x, y: y + (sub ? 13 : 13.5), 'text-anchor': 'middle' }, label)];
  if (sub) parts.push(text({ class: 'iso-sub', x: at.x, y: y + 24, 'text-anchor': 'middle' }, sub.toUpperCase()));
  return {
    box: { x0: x, y0: y, x1: x + w, y1: y + h },
    svg: el('g', {
      class: `sc-node iso-tag ${focal ? 'k-focal' : 'k-backend'}${step ? ' sc-drop' : ''}`,
      'data-sc-node': id,
      ...(step ? { 'data-sc-step': step, style: `--step:${step}` } : {}),
      tabindex: 0,
      role: 'group',
      'aria-label': [label, sub].filter(Boolean).join(', '),
    }, parts),
  };
}

export function render(spec) {
  const problems = [];
  const rooms = (spec.rooms || []).map((r, i) => ({ ...r, id: r.id || `room${i}` }));
  const marks = spec.marks || [];
  const boxesIn = (spec.boxes || []).map((b, i) => {
    const kind = b.kind || 'furniture';
    const h = b.h ?? DEF_H[kind];
    const res = resolve(b, b.w, b.d, h);
    const rad = kind === 'tree' || res.r === 'round' ? Math.min(b.w, b.d) / 2 : Math.min(res.r || 0, b.w / 2, b.d / 2);
    // a roof or dome adds to the box's height for sorting and for its tag
    const capH = res.top ? res.topH ?? Math.min(b.w, b.d) * 0.35 : 0;
    return { ...b, id: b.id || `b${i}`, kind, h, res, capH, rect: { ...rectOf(b), r: rad }, z: 0 };
  });
  const ids = new Set();
  for (const o of [...rooms, ...boxesIn]) {
    if (ids.has(o.id)) problems.push({ code: 'E_DUP_ID', at: o.id, msg: `duplicate id "${o.id}"`, fix: 'ids must be unique' });
    ids.add(o.id);
  }
  if (problems.length) return { problems };

  // the plate: given, or everything plus a margin
  const all = [...rooms.map(rectOf), ...boxesIn.map((b) => b.rect), ...marks.map(rectOf)];
  const m = 16;
  const plate = spec.plate && spec.plate.w
    ? { x0: spec.plate.x ?? 0, y0: spec.plate.y ?? 0, x1: (spec.plate.x ?? 0) + spec.plate.w, y1: (spec.plate.y ?? 0) + spec.plate.d }
    : { x0: Math.min(...all.map((r) => r.x0)) - m, y0: Math.min(...all.map((r) => r.y0)) - m, x1: Math.max(...all.map((r) => r.x1)) + m, y1: Math.max(...all.map((r) => r.y1)) + m };
  for (const o of [...rooms.map((r) => ({ id: r.id, rect: rectOf(r) })), ...boxesIn]) {
    const r = o.rect;
    if (r.x0 < plate.x0 || r.y0 < plate.y0 || r.x1 > plate.x1 || r.y1 > plate.y1) problems.push({ code: 'W_PLAN_BOUNDS', at: o.id, msg: `"${o.id}" hangs past the plate`, fix: 'move it inside the plate, or enlarge plate.w / plate.d' });
  }
  const standing = boxesIn.filter((b) => b.kind !== 'tree');
  for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++) {
    if (overlaps(standing[i].rect, standing[j].rect)) problems.push({ code: 'W_PLAN_OVERLAP', at: standing[j].id, msg: `"${standing[i].id}" and "${standing[j].id}" overlap on the plate`, fix: 'move one so their footprints do not overlap' });
  }
  const nodes = rooms.length + boxesIn.filter((b) => b.label).length;
  if (nodes > 14) problems.push({ code: 'W_BUDGET', at: '(root)', msg: `${nodes} named rooms and boxes`, fix: 'name only what the reader needs; leave furniture unnamed' });

  const walls = sharedWalls(rooms.filter((r) => r.walls));
  const boxes = paintOrder([...walls, ...boxesIn]);
  const out = [];
  const plateSolid = prism({ ...plate, r: 6 }, -6, 6, { cls: 'iso-plate' });
  out.push(el('g', { class: 'iso-plate-g' }, plateSolid.svg));
  for (const mk of marks) {
    const r = { ...rectOf(mk), r: mk.r || 0 };
    out.push(flat(r, 0, 'iso-mark'));
    // a road gets a dashed centre line along its long side
    if (mk.kind === 'road') {
      const long = r.x1 - r.x0 >= r.y1 - r.y0;
      const a = long ? iso(r.x0 + 4, (r.y0 + r.y1) / 2, 0) : iso((r.x0 + r.x1) / 2, r.y0 + 4, 0);
      const c = long ? iso(r.x1 - 4, (r.y0 + r.y1) / 2, 0) : iso((r.x0 + r.x1) / 2, r.y1 - 4, 0);
      out.push(el('path', { class: 'it-line it-dash iso-centreline', d: `M${a.x},${a.y} L${c.x},${c.y}` }));
    }
  }
  for (const r of rooms) out.push(flat({ ...rectOf(r), r: 0 }, 0, `iso-floor${r.focal ? ' k-focal' : ''}`));

  // every box, back to front; phased boxes drop into place on their step
  const steps = new Set();
  for (const b of boxes) {
    const isTree = b.kind === 'tree';
    let svg;
    if (isTree) {
      const c = { x: (b.rect.x0 + b.rect.x1) / 2, y: (b.rect.y0 + b.rect.y1) / 2 };
      const trunk = prism({ x0: c.x - 2, y0: c.y - 2, x1: c.x + 2, y1: c.y + 2, r: 0 }, 0, 8);
      const canopy = prism(b.rect, 8, b.h - 8, { cls: 'iso-canopy' });
      svg = trunk.svg + canopy.svg;
    } else {
      const ds = dressedSolid({ rect: b.rect, t: b.h, ...(b.res || {}) }, b.z);
      svg = ds.back + (ds.front || '');
    }
    const st = b.step ? Math.min(12, b.step) : undefined;
    if (st) steps.add(st);
    out.push(el('g', {
      class: `iso-box iso-${b.kind}${b.focal && b.kind === 'building' ? ' k-focal' : ''}${st ? ' sc-drop' : ''}`,
      'data-kind': b.kind,
      ...(st ? { 'data-sc-step': st, style: `--step:${st}` } : {}),
    }, svg));
  }

  // tags last, so walls never cut them; nudged apart if they would overlap
  const tags = [];
  const placed = [];
  const place = (label, sub, x, y, z, opts) => {
    const t = tag(label, sub, iso(x, y, z), opts);
    for (let guard = 0; guard < 8 && placed.some((p) => overlaps(p, t.box)); guard++) {
      const hit = placed.find((p) => overlaps(p, t.box));
      const dy = hit.y1 - t.box.y0 + 4;
      const moved = tag(label, sub, { x: (t.box.x0 + t.box.x1) / 2, y: (t.box.y0 + t.box.y1) / 2 + dy }, opts);
      Object.assign(t, moved);
    }
    if (placed.some((p) => overlaps(p, t.box))) problems.push({ code: 'W_PLAN_TAGS', at: opts.id, msg: `the tag for "${label}" overlaps another`, fix: 'move one of the rooms or boxes, or shorten a name' });
    placed.push(t.box);
    tags.push(t.svg);
  };
  for (const r of rooms) {
    const phase = Math.min(...boxesIn.filter((b) => b.step && overlaps(b.rect, rectOf(r))).map((b) => b.step), Infinity);
    const st = r.step ?? (Number.isFinite(phase) ? phase : undefined);
    if (st) steps.add(st);
    place(r.label || r.id, r.sub, r.x + r.w / 2, r.y + r.d / 2, 0, { focal: r.focal, step: st && Math.min(12, st), id: r.id });
  }
  for (const b of boxesIn.filter((x) => x.label)) {
    place(b.label, b.sub, (b.rect.x0 + b.rect.x1) / 2, (b.rect.y0 + b.rect.y1) / 2, b.z + b.h + (b.capH || 0), { focal: b.focal, step: b.step && Math.min(12, b.step), id: b.id });
  }
  out.push(el('g', { class: 'iso-tags' }, tags));

  const pts = [...plateSolid.sil, ...boxes.flatMap((b) => [iso(b.rect.x0, b.rect.y0, b.h + (b.capH || 0)), iso(b.rect.x1, b.rect.y0, b.h + (b.capH || 0)), iso(b.rect.x0, b.rect.y1, b.h)])];
  const x0 = Math.min(...pts.map((p) => p.x), ...placed.map((p) => p.x0)) - 24;
  const x1 = Math.max(...pts.map((p) => p.x), ...placed.map((p) => p.x1)) + 24;
  const y0 = Math.min(...pts.map((p) => p.y), ...placed.map((p) => p.y0)) - 24;
  const y1 = Math.max(...pts.map((p) => p.y), ...placed.map((p) => p.y1)) + 24;
  return {
    body: el('g', { class: 'sc-nodes iso-plan' }, out),
    viewBox: [x0, y0, x1 - x0, y1 - y0],
    steps: Math.min(12, Math.max(0, ...steps)),
    problems,
    graph: { nodes: [...rooms.map((r) => ({ id: r.id, label: r.label || r.id })), ...boxesIn.filter((b) => b.label).map((b) => ({ id: b.id, label: b.label }))], edges: [] },
  };
}
