// Shared helpers for importers. Imported text is untrusted data: we only
// ever copy it into labels (truncated, tags stripped), never interpret it.

// Named entities seen in diagram sources (draw.io labels, PlantUML, HTML in
// Mermaid). Unknown names are left as written.
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•', times: '×', divide: '÷', minus: '−', plusmn: '±',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔', rArr: '⇒', lArr: '⇐', hArr: '⇔',
  lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›',
  copy: '©', reg: '®', trade: '™', deg: '°', sect: '§', para: '¶', dagger: '†', Dagger: '‡', prime: '′', Prime: '″',
  euro: '€', pound: '£', yen: '¥', cent: '¢', curren: '¤', permil: '‰', micro: 'µ', infin: '∞', ne: '≠', le: '≤', ge: '≥', asymp: '≈',
  frac12: '½', frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', check: '✓', cross: '✗', hearts: '♥', star: '☆',
};
// &#128;–&#159; mean windows-1252 characters in HTML, not C1 controls
const CP1252 = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };

// A numeric reference as HTML reads it: out-of-range values and lone
// surrogates become U+FFFD instead of throwing.
function numericRef(body) {
  const n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
  if (!Number.isFinite(n) || n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '\uFFFD';
  if (n >= 128 && n <= 159) return CP1252[n] || '\uFFFD';
  return String.fromCodePoint(n);
}

export function clean(s, max = 40) {
  let t = String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#[xX][0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => (e[0] === '#' ? numericRef(e) : ENT[e] ?? m))
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
