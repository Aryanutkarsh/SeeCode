// Shared helpers for importers. Imported text is untrusted data: we only
// ever copy it into labels (truncated, tags stripped), never interpret it.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function clean(s, max = 40) {
  let t = String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? (e.startsWith('#') ? String.fromCodePoint(parseInt(e.slice(1).replace(/^x/, '0x'), e[1] === 'x' ? 16 : 10)) : m))
    .replace(/\\n/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  return t;
}

export function makeId(s, used = new Set()) {
  let base = String(s || 'n').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'n';
  if (!/^[a-z_]/.test(base)) base = `n_${base}`;
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
  used.add(id);
  return id;
}

// Safe id for a source id (keeps it if valid, otherwise slugifies).
export function safeId(raw, map, used) {
  if (map.has(raw)) return map.get(raw);
  const ok = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(raw) && !used.has(raw) ? raw : makeId(raw, used);
  used.add(ok);
  map.set(raw, ok);
  return ok;
}

// Turn absolute positions (draw.io / Excalidraw) into coarse grid cells,
// preserving the author's arrangement.
export function gridFromPositions(nodes) {
  const placed = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (!placed.length) return;
  const cluster = (vals, gap) => {
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    const centers = [];
    for (const v of sorted) {
      if (!centers.length || v - centers[centers.length - 1].max > gap) centers.push({ min: v, max: v });
      else centers[centers.length - 1].max = v;
    }
    return (v) => centers.findIndex((c) => v >= c.min - 0.001 && v <= c.max + 0.001);
  };
  const w = Math.max(40, median(placed.map((n) => n.w || 120)) * 0.6);
  const h = Math.max(30, median(placed.map((n) => n.h || 60)) * 0.6);
  const cx = placed.map((n) => n.x + (n.w || 0) / 2), cy = placed.map((n) => n.y + (n.h || 0) / 2);
  const colOf = cluster(cx, w), rowOf = cluster(cy, h);
  const taken = new Set();
  placed.forEach((n, i) => {
    let row = rowOf(cy[i]), col = colOf(cx[i]);
    while (taken.has(`${row},${col}`)) col++;
    taken.add(`${row},${col}`);
    n.row = row;
    n.col = col;
  });
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] || 0;
}

export function stripComments(text, { hash = false, slash = true, percent = false } = {}) {
  return text
    .split('\n')
    .map((l) => {
      let out = l;
      if (percent) out = out.replace(/^\s*%%.*$/, '');
      if (slash) out = out.replace(/(^|[^:])\/\/.*$/, '$1');
      if (hash) out = out.replace(/^\s*#.*$/, '');
      return out;
    })
    .join('\n');
}
