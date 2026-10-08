// Whiteboard formats with absolute positions: draw.io (.drawio, .drawio.png,
// .drawio.svg, compressed or not) and Excalidraw. Positions become coarse
// grid cells so the author's arrangement survives the redraw.
import { inflateRawSync, inflateSync } from 'node:zlib';
import { clean, safeId, gridFromPositions } from './common.mjs';

// Generous ceilings: real boards are far smaller; a file past these is
// malformed or hostile, and parsing it would only burn memory.
export const MAX_CELLS = 20000;
const num = (v) => { const n = Number(v || 0); return Number.isFinite(n) && Math.abs(n) < 1e7 ? n : NaN; };

function xmlAttrs(tag) {
  const a = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) a[m[1]] = m[2].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, ' ').replace(/&amp;/g, '&');
  return a;
}

function decodeDiagram(inner) {
  const t = inner.trim();
  if (t.startsWith('<')) return t;
  try {
    const raw = inflateRawSync(Buffer.from(t, 'base64')).toString('utf8');
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

export function extractDrawioXml(buf, name) {
  if (/\.png$/i.test(name)) {
    // the mxfile lives in a zTXt/tEXt chunk keyed "mxfile"
    let p = 8;
    while (p < buf.length) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      const data = buf.subarray(p + 8, p + 8 + len);
      if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
        const nul = data.indexOf(0);
        const key = data.toString('latin1', 0, nul);
        if (key === 'mxfile' || key === 'mxGraphModel') {
          let val = type === 'zTXt' ? inflateSync(data.subarray(nul + 2)).toString('utf8') : data.toString('utf8', type === 'iTXt' ? data.indexOf(0, nul + 3) + 1 : nul + 1);
          return decodeURIComponent(val);
        }
      }
      p += 12 + len;
    }
    return '';
  }
  const text = buf.toString('utf8');
  if (/\.svg$/i.test(name)) {
    const m = text.match(/content="([^"]+)"/);
    return m ? xmlAttrs(`x content="${m[1]}"`).content : '';
  }
  return text;
}

export function parseDrawio(xmlIn) {
  let xml = xmlIn;
  const dm = xml.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/);
  if (dm && !/<mxGraphModel/.test(dm[1])) xml = decodeDiagram(dm[1]);
  const cells = [...xml.matchAll(/<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)].map((m) => {
    const a = xmlAttrs(m[1]);
    const g = m[2] && m[2].match(/<mxGeometry\b([^>]*)/);
    const geo = g ? xmlAttrs(g[1]) : {};
    return { ...a, x: num(geo.x), y: num(geo.y), w: num(geo.width), h: num(geo.height) };
  });
  // also <UserObject label=...><mxCell .../></UserObject>
  for (const m of xml.matchAll(/<(?:UserObject|object)\b([^>]*)>\s*<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)) {
    const o = xmlAttrs(m[1]), c = xmlAttrs(m[2]);
    const g = m[3] && m[3].match(/<mxGeometry\b([^>]*)/);
    const geo = g ? xmlAttrs(g[1]) : {};
    cells.push({ ...c, id: o.id, value: o.label, x: num(geo.x), y: num(geo.y), w: num(geo.width), h: num(geo.height) });
  }
  if (cells.length > MAX_CELLS) return { error: `draw.io page has ${cells.length} cells (limit ${MAX_CELLS})`, fix: 'export just the page or region you want drawn, then import that' };
  const bad = cells.find((c) => c.vertex === '1' && [c.x, c.y, c.w, c.h].some(Number.isNaN));
  if (bad) return { error: `draw.io cell "${clean(bad.id, 24)}" has non-numeric or out-of-range geometry`, fix: 'fix or delete that shape in draw.io, then import again' };
  const seen = new Set();
  for (const c of cells) {
    if (c.id === undefined) continue;
    if (seen.has(c.id)) return { error: `draw.io file repeats cell id "${clean(c.id, 24)}"`, fix: 'give each shape a unique id (re-save from draw.io), then import again' };
    seen.add(c.id);
  }
  const byId = new Map(cells.map((c) => [c.id, c]));
  const map = new Map(), used = new Set();
  const containers = new Set(cells.filter((c) => c.vertex === '1' && /swimlane|group|container=1/.test(c.style || '')).map((c) => c.id));
  // child geometry is relative to its parent vertex; a cyclic parent chain
  // (only in hand-edited or hostile files) is cut at the first repeat
  const abs = (c) => {
    let x = c.x, y = c.y, p = byId.get(c.parent);
    const chain = new Set([c.id]);
    while (p && p.vertex === '1' && !chain.has(p.id)) { chain.add(p.id); x += p.x; y += p.y; p = byId.get(p.parent); }
    return { x, y };
  };
  const groups = [...containers].map((id) => ({ id: safeId(`g_${id}`, map, used), src: id, label: clean(byId.get(id).value || 'Group', 32) }));
  const gmap = new Map(groups.map((g) => [g.src, g.id]));
  const nodes = [];
  const idOf = new Map();
  for (const c of cells) {
    if (c.vertex !== '1' || containers.has(c.id)) continue;
    const label = clean(c.value || '');
    if (!label && !/ellipse|rhombus/.test(c.style || '')) continue;
    const st = c.style || '';
    const id = safeId(label ? label.toLowerCase() : `n${c.id}`, map, used);
    idOf.set(c.id, id);
    const p = abs(c);
    nodes.push({
      id, label: label || '•',
      ...(/rhombus/.test(st) ? { shape: 'decision' } : /ellipse/.test(st) && /start|end|terminal/i.test(label) ? { shape: 'terminal' } : /parallelogram/.test(st) ? { shape: 'io' } : {}),
      ...(/cylinder|datastore|database/.test(st) ? { kind: 'store' } : /actor|cloud|umlActor/.test(st) ? { kind: 'external' } : /dashed=1/.test(st) ? { kind: 'optional' } : {}),
      ...(gmap.has(c.parent) ? { group: gmap.get(c.parent) } : {}),
      x: p.x, y: p.y, w: c.w, h: c.h,
    });
  }
  const edges = [];
  for (const c of cells) {
    if (c.edge !== '1') continue;
    let a = idOf.get(c.source), b = idOf.get(c.target);
    if (!a || !b) continue;
    const st = c.style || '';
    // draw.io's default end is an arrow; direction follows the arrowheads
    const start = /startArrow=(?!none)/.test(st), end = !/endArrow=none/.test(st);
    if (start && !end) [a, b] = [b, a];
    const label = clean(c.value || cells.find((x) => x.parent === c.id && x.value)?.value || '', 28);
    edges.push({ from: a, to: b, ...(label ? { label } : {}), ...(/dashed=1/.test(st) ? { kind: 'async' } : {}), ...(start && end ? { both: true } : {}), ...(!start && !end ? { kind: 'muted' } : {}) });
  }
  gridFromPositions(nodes);
  const pageName = (xmlIn.match(/<diagram[^>]*name="([^"]*)"/) || [])[1];
  return { kind: 'graph', hint: guessHint(nodes, edges), title: pageName ? clean(pageName, 60) : undefined, nodes, edges, groups: groups.filter((g) => nodes.some((n) => n.group === g.id)).map(({ src, ...g }) => g) };
}

export function parseExcalidraw(json) {
  const doc = typeof json === 'string' ? JSON.parse(json) : json;
  const els = (doc.elements || []).filter((e) => e && !e.isDeleted);
  if (els.length > MAX_CELLS) return { error: `Excalidraw board has ${els.length} elements (limit ${MAX_CELLS})`, fix: 'copy just the region you want drawn into a new board, then import that' };
  const byId = new Map();
  for (const e of els) {
    // a repeated id would fold the same bound text into many nodes
    if (byId.has(e.id)) return { error: `Excalidraw board repeats element id "${clean(e.id, 24)}"`, fix: 'copy the shapes into a fresh board (Excalidraw re-ids them on paste), then import again' };
    byId.set(e.id, e);
  }
  const map = new Map(), used = new Set();
  const textFor = (e) => {
    const bound = (e.boundElements || []).map((b) => byId.get(b.id)).find((b) => b && b.type === 'text')
      || els.find((t) => t.type === 'text' && t.containerId === e.id);
    return bound ? bound.text : '';
  };
  const frames = els.filter((e) => e.type === 'frame');
  const groups = frames.map((f) => ({ id: safeId(`g_${f.name || f.id}`, map, used), src: f.id, label: clean(f.name || 'Frame', 32) }));
  const gmap = new Map(groups.map((g) => [g.src, g.id]));
  const nodes = [];
  const idOf = new Map();
  for (const e of els) {
    if (!['rectangle', 'ellipse', 'diamond'].includes(e.type)) continue;
    const label = clean(textFor(e));
    if (!label) continue;
    const id = safeId(label.toLowerCase(), map, used);
    idOf.set(e.id, id);
    nodes.push({ id, label, ...(e.type === 'diamond' ? { shape: 'decision' } : {}), ...(e.strokeStyle === 'dashed' ? { kind: 'optional' } : {}), ...(gmap.has(e.frameId) ? { group: gmap.get(e.frameId) } : {}), x: e.x, y: e.y, w: e.width, h: e.height });
  }
  // free-standing text near nothing becomes a node too
  for (const t of els.filter((e) => e.type === 'text' && !e.containerId)) {
    const label = clean(t.text);
    if (!label || label.length > 40) continue;
    const id = safeId(label.toLowerCase(), map, used);
    idOf.set(t.id, id);
    nodes.push({ id, label, kind: 'muted', x: t.x, y: t.y, w: t.width, h: t.height });
  }
  const edges = [];
  for (const a of els.filter((e) => e.type === 'arrow' || e.type === 'line')) {
    const s = idOf.get(a.startBinding?.elementId), t = idOf.get(a.endBinding?.elementId);
    if (!s || !t) continue;
    const label = clean(textFor(a), 28);
    edges.push({ from: s, to: t, ...(label ? { label } : {}), ...(a.strokeStyle === 'dashed' ? { kind: 'async' } : {}), ...(a.type === 'line' || !a.endArrowhead ? { kind: 'muted' } : {}) });
  }
  gridFromPositions(nodes);
  return { kind: 'graph', hint: guessHint(nodes, edges), nodes, edges, groups: groups.filter((g) => nodes.some((n) => n.group === g.id)).map(({ src, ...g }) => g) };
}

function guessHint(nodes, edges) {
  if (nodes.some((n) => n.shape === 'decision')) return 'flowchart';
  if (nodes.some((n) => n.kind === 'store')) return 'architecture';
  return edges.length ? 'architecture' : 'high-level';
}
