// Resolve `"data": "file.csv"` style references so chart data never has to
// pass through the model. Supports CSV/TSV (header row) and JSON arrays.
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

export function parseDelimited(textIn, delim) {
  const rows = [];
  let row = [], cell = '', q = false;
  const t = textIn.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const [head, ...body] = clean;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), num(r[i])])));
}

function num(v) {
  if (v === undefined) return v;
  const s = String(v).trim();
  return s !== '' && !isNaN(Number(s.replace(/,/g, ''))) ? Number(s.replace(/,/g, '')) : s;
}

export function readTable(path) {
  const ext = extname(path).toLowerCase();
  const raw = readFileSync(path, 'utf8');
  if (ext === '.json') {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : j.data || j.rows || [];
  }
  return parseDelimited(raw, ext === '.tsv' ? '\t' : ',');
}

// Charts: bar.data / sankey.links may be a file path; columns chosen by x/y or from/to/value.
export function loadData(spec, baseDir) {
  if (spec.type === 'bar' && typeof spec.data === 'string') {
    const rows = readTable(resolve(baseDir, spec.data));
    if (!rows.length) throw new Error(`no rows in ${spec.data}`);
    const cols = Object.keys(rows[0]);
    const x = spec.x || cols.find((c) => typeof rows[0][c] === 'string') || cols[0];
    const ys = spec.y ? [spec.y] : cols.filter((c) => c !== x && typeof rows[0][c] === 'number');
    if (!ys.length) throw new Error(`no numeric column in ${spec.data}`);
    if (ys.length === 1) return { ...spec, data: rows.map((r) => [String(r[x]), Number(r[ys[0]])]) };
    return { ...spec, data: undefined, categories: rows.map((r) => String(r[x])), series: ys.slice(0, 5).map((y) => ({ name: y, values: rows.map((r) => Number(r[y])) })) };
  }
  if (spec.type === 'sankey' && typeof spec.links === 'string') {
    const rows = readTable(resolve(baseDir, spec.links));
    const f = spec.from || 'from', t = spec.to || 'to', v = spec.value || 'value';
    return { ...spec, links: rows.map((r) => [String(r[f] ?? r.source), String(r[t] ?? r.target), Number(r[v])]) };
  }
  if (spec.type === 'line' && typeof spec.data === 'string') {
    const rows = readTable(resolve(baseDir, spec.data));
    const cols = Object.keys(rows[0] || {});
    const xc = spec.xCol || cols.find((c) => typeof rows[0][c] === 'string') || cols[0];
    const ys = cols.filter((c) => c !== xc && typeof rows[0][c] === 'number').slice(0, 6);
    const { data, xCol, ...rest } = spec;
    return { ...rest, x: rows.map((r) => String(r[xc])), series: ys.map((y) => ({ name: y, values: rows.map((r) => (typeof r[y] === 'number' ? r[y] : null)) })) };
  }
  if (spec.type === 'scatter' && typeof spec.data === 'string') {
    const rows = readTable(resolve(baseDir, spec.data));
    const cols = Object.keys(rows[0] || {});
    const nums = cols.filter((c) => typeof rows[0][c] === 'number');
    const lab = spec.labelCol || cols.find((c) => typeof rows[0][c] === 'string');
    const xc = spec.xCol || nums[0], yc = spec.yCol || nums[1], sc = spec.sizeCol;
    const { data, xCol, yCol, sizeCol, labelCol, ...rest } = spec;
    return { ...rest, xLabel: rest.xLabel || xc, yLabel: rest.yLabel || yc, points: rows.map((r) => ({ ...(lab ? { label: String(r[lab]).slice(0, 28) } : {}), x: Number(r[xc]), y: Number(r[yc]), ...(sc ? { size: Number(r[sc]) } : {}) })) };
  }
  if (spec.type === 'heatmap' && typeof spec.data === 'string') {
    const rows = readTable(resolve(baseDir, spec.data));
    const cols = Object.keys(rows[0] || {});
    const lab = cols.find((c) => typeof rows[0][c] === 'string') || cols[0];
    const nums = cols.filter((c) => c !== lab);
    const { data, ...rest } = spec;
    return { ...rest, rows: rows.map((r) => String(r[lab])), cols: nums, values: rows.map((r) => nums.map((c) => (typeof r[c] === 'number' ? r[c] : null))) };
  }
  return spec;
}
