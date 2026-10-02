// Text model formats: Structurizr DSL (C4), BPMN XML, SQL DDL, Prisma, DBML, OpenAPI.
import { clean, safeId } from './common.mjs';

export function parseStructurizr(src) {
  const map = new Map(), used = new Set();
  const nodes = [], edges = [], groups = [];
  const stack = [];
  const lines = src.replace(/\r/g, '').split('\n').map((l) => l.replace(/^\s*(#|\/\/).*$/, '').trim()).filter(Boolean);
  const strs = (s) => [...s.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  for (const l of lines) {
    let m;
    if ((m = l.match(/^(?:(\w+)\s*=\s*)?(person|softwareSystem|softwaresystem|container|component)\b(.*?)(\{)?$/i))) {
      const type = m[2].toLowerCase();
      const s = strs(m[3]);
      const id = safeId(m[1] || s[0] || `n${nodes.length}`, map, used);
      const tech = type === 'container' || type === 'component' ? s[2] : undefined;
      const isGroup = m[4] && type === 'softwaresystem';
      if (isGroup) { groups.push({ id: `g_${id}`, label: clean(s[0] || id, 32) }); stack.push(`g_${id}`); }
      else {
        if (m[4]) stack.push(null);
        nodes.push({ id, label: clean(s[0] || id), ...(tech ? { sub: clean(tech, 48) } : {}), ...(type === 'person' ? { kind: 'external' } : /database|db|store/i.test(`${s.join(' ')} ${m[3]}`) ? { kind: 'store' } : {}), ...(stack.filter(Boolean).length ? { group: stack.filter(Boolean).at(-1) } : {}) });
      }
      continue;
    }
    if ((m = l.match(/^(\w+)\s*->\s*(\w+)\s*(.*)$/))) {
      const s = strs(m[3]);
      edges.push({ from: safeId(m[1], map, used), to: safeId(m[2], map, used), ...(s[0] ? { label: clean(s[0], 28) } : {}) });
      continue;
    }
    if (l.endsWith('{')) { stack.push(null); continue; }
    if (l === '}') stack.pop();
  }
  const ids = new Set(nodes.map((n) => n.id));
  return { kind: 'graph', hint: groups.length ? 'architecture' : 'high-level', dir: 'LR', nodes, edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)), groups: groups.filter((g) => nodes.some((n) => n.group === g.id)) };
}

export function parseBpmn(xml) {
  const map = new Map(), used = new Set();
  const attr = (tag, k) => (tag.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
  const nodes = [];
  const idOf = new Map();
  const NODE = /<(?:\w+:)?(task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|subProcess|callActivity|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent)\b([^>]*)>/g;
  for (const m of xml.matchAll(NODE)) {
    const t = m[1];
    const raw = attr(m[2], 'id');
    const name = attr(m[2], 'name');
    const id = safeId(raw, map, used);
    idOf.set(raw, id);
    nodes.push({ id, label: clean(name || (/start/.test(t) ? 'Start' : /end/.test(t) ? 'End' : /Gateway/.test(t) ? '?' : raw)), ...(/Gateway/.test(t) ? { shape: 'decision' } : /Event/.test(t) ? { shape: 'terminal' } : {}) });
  }
  const edges = [];
  for (const m of xml.matchAll(/<(?:\w+:)?sequenceFlow\b([^>]*)>/g)) {
    const a = idOf.get(attr(m[1], 'sourceRef')), b = idOf.get(attr(m[1], 'targetRef'));
    if (a && b) edges.push({ from: a, to: b, ...(attr(m[1], 'name') ? { label: clean(attr(m[1], 'name'), 28) } : {}) });
  }
  const lanes = [];
  for (const m of xml.matchAll(/<(?:\w+:)?lane\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?lane>/g)) {
    const lid = safeId(attr(m[1], 'id'), map, used);
    lanes.push({ id: lid, label: clean(attr(m[1], 'name') || lid, 28) });
    for (const r of m[2].matchAll(/<(?:\w+:)?flowNodeRef>([^<]+)</g)) {
      const n = nodes.find((x) => x.id === idOf.get(r[1].trim()));
      if (n) n.lane = lid;
    }
  }
  return { kind: 'graph', hint: lanes.length ? 'swimlane' : 'flowchart', dir: lanes.length ? 'LR' : 'TB', nodes, edges, lanes };
}

// ---- schemas ---------------------------------------------------------------
function schemaModel(tables, refs) {
  const map = new Map(), used = new Set();
  const nodes = tables.map((t) => ({ id: safeId(t.name, map, used), label: clean(t.name, 40), fields: t.cols.slice(0, 12).map((c) => [clean(c.name, 24), clean(c.type, 20), ...(c.key ? [c.key] : [])]) }));
  const edges = refs
    .filter((r) => map.has(r.from) && map.has(r.to))
    .map((r) => ({ from: `${map.get(r.from)}.${r.fromCol}`, to: `${map.get(r.to)}.${r.toCol}`, label: '', kind: r.kind || 'many-one' }));
  return { kind: 'graph', hint: 'db-schema', dir: 'LR', nodes, edges, dropped: tables.reduce((s, t) => s + Math.max(0, t.cols.length - 12), 0) };
}

export function parseSql(src) {
  const text = src.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tables = [], refs = [];
  const unq = (s) => s.replace(/[`"[\]]/g, '').split('.').pop();
  for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([`"[\]\w.]+)\s*\(([\s\S]*?)\)\s*(?:;|$)/gi)) {
    const name = unq(m[1]);
    const cols = [];
    const pk = new Set();
    // split on commas not inside parentheses
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of m[2]) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
      let mm;
      if ((mm = raw.match(/^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]+)\)/i))) { mm[1].split(',').forEach((c) => pk.add(unq(c.trim()))); continue; }
      if ((mm = raw.match(/^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+([`"[\]\w.]+)\s*\(([^)]+)\)/i))) { refs.push({ from: name, fromCol: unq(mm[1].trim()), to: unq(mm[2]), toCol: unq(mm[3].trim()) }); continue; }
      if (/^(unique|index|key|check|constraint)\b/i.test(raw)) continue;
      const c = raw.match(/^([`"[\]\w]+)\s+([\w]+(?:\s*\([^)]*\))?(?:\s+varying)?(?:\[\])?)(.*)$/i);
      if (!c) continue;
      const col = { name: unq(c[1]), type: c[2].toLowerCase().replace(/\s+/g, '') };
      if (/primary\s+key/i.test(c[3])) pk.add(col.name);
      else if (/\bunique\b/i.test(c[3])) col.key = 'UQ';
      const r = c[3].match(/references\s+([`"[\]\w.]+)\s*(?:\(([^)]+)\))?/i);
      if (r) { col.key = 'FK'; refs.push({ from: name, fromCol: col.name, to: unq(r[1]), toCol: r[2] ? unq(r[2].trim()) : 'id' }); }
      cols.push(col);
    }
    for (const c of cols) if (pk.has(c.name)) c.key = 'PK';
    for (const r of refs.filter((x) => x.from === name)) { const c = cols.find((x) => x.name === r.fromCol); if (c && !c.key) c.key = 'FK'; }
    tables.push({ name, cols });
  }
  for (const m of text.matchAll(/alter\s+table\s+(?:only\s+)?([`"[\]\w.]+)[\s\S]*?foreign\s+key\s*\(([^)]+)\)\s*references\s+([`"[\]\w.]+)\s*\(([^)]+)\)/gi)) {
    refs.push({ from: unq(m[1]), fromCol: unq(m[2].trim()), to: unq(m[3]), toCol: unq(m[4].trim()) });
  }
  return schemaModel(tables, refs);
}

export function parsePrisma(src) {
  const tables = [], refs = [];
  for (const m of src.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const cols = [];
    for (const line of m[2].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))) {
      const f = line.match(/^(\w+)\s+([\w[\]?]+)(.*)$/);
      if (!f) continue;
      const rel = f[3].match(/@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]/);
      if (rel) { refs.push({ from: m[1], fromCol: rel[1].trim(), to: f[2].replace(/[[\]?]/g, ''), toCol: rel[2].trim() }); continue; }
      if (/^[A-Z]/.test(f[2]) && !/^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes|Unsupported)/.test(f[2])) continue; // back-relation
      cols.push({ name: f[1], type: f[2].toLowerCase(), key: /@id\b/.test(f[3]) ? 'PK' : /@unique/.test(f[3]) ? 'UQ' : undefined });
    }
    tables.push({ name: m[1], cols });
  }
  for (const r of refs) { const t = tables.find((x) => x.name === r.from); const c = t?.cols.find((x) => x.name === r.fromCol); if (c && !c.key) c.key = 'FK'; }
  return schemaModel(tables, refs);
}

export function parseDbml(src) {
  const tables = [], refs = [];
  const text = src.replace(/\/\/.*$/gm, '');
  for (const m of text.matchAll(/Table\s+([\w".]+)(?:\s+as\s+\w+)?\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\n\}/gi)) {
    const name = m[1].replace(/"/g, '').split('.').pop();
    const cols = [];
    for (const line of m[2].split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (/^(indexes|Note)\b/i.test(line)) break;
      const f = line.match(/^([\w"]+)\s+([\w()",.]+)\s*(?:\[([^\]]*)\])?/);
      if (!f) continue;
      const opts = f[3] || '';
      const col = { name: f[1].replace(/"/g, ''), type: f[2].replace(/"/g, ''), key: /\bpk\b|primary key/i.test(opts) ? 'PK' : /unique/i.test(opts) ? 'UQ' : undefined };
      const r = opts.match(/ref:\s*([<>-])\s*([\w".]+)\.([\w"]+)/i);
      if (r) { col.key = col.key || 'FK'; refs.push({ from: name, fromCol: col.name, to: r[2].replace(/"/g, '').split('.').pop(), toCol: r[3].replace(/"/g, ''), kind: r[1] === '-' ? 'one-one' : r[1] === '<' ? 'one-many' : 'many-one' }); }
      cols.push(col);
    }
    tables.push({ name, cols });
  }
  for (const m of text.matchAll(/Ref\s*(?:\w+)?\s*:\s*([\w".]+)\.([\w"]+)\s*([<>-])\s*([\w".]+)\.([\w"]+)/gi)) {
    refs.push({ from: m[1].replace(/"/g, '').split('.').pop(), fromCol: m[2].replace(/"/g, ''), to: m[4].replace(/"/g, '').split('.').pop(), toCol: m[5].replace(/"/g, ''), kind: m[3] === '-' ? 'one-one' : m[3] === '<' ? 'one-many' : 'many-one' });
  }
  return schemaModel(tables, refs);
}

// OpenAPI (JSON, or YAML read line-wise): group endpoints by tag / first path segment.
export function parseOpenApi(src) {
  const ops = [];
  let title;
  try {
    const j = JSON.parse(src);
    title = j.info?.title;
    for (const [path, item] of Object.entries(j.paths || {})) {
      for (const [method, op] of Object.entries(item)) {
        if (!/^(get|post|put|patch|delete|head|options)$/.test(method)) continue;
        ops.push({ path, method: method.toUpperCase(), tag: op.tags?.[0] });
      }
    }
  } catch {
    title = (src.match(/^\s{2}title:\s*["']?(.+?)["']?\s*$/m) || [])[1];
    const lines = src.replace(/\r/g, '').split('\n');
    const start = lines.findIndex((l) => /^paths:\s*$/.test(l));
    let path = null, method = null;
    for (let i = start + 1; start >= 0 && i < lines.length; i++) {
      const l = lines[i];
      if (/^\S/.test(l)) break;
      let m;
      if ((m = l.match(/^ {2}(["']?)(\/[^"':]*)\1:\s*$/))) { path = m[2]; continue; }
      if ((m = l.match(/^ {4}(get|post|put|patch|delete|head|options):\s*$/))) { method = m[1].toUpperCase(); ops.push({ path, method }); continue; }
      if (method && (m = l.match(/^ {6}tags:\s*\[?\s*["']?([^"'\],]+)/))) ops[ops.length - 1].tag = m[1].trim();
      else if (method && /^ {6}tags:\s*$/.test(l) && (m = (lines[i + 1] || '').match(/^\s+-\s*["']?([^"']+)/))) ops[ops.length - 1].tag = m[1].trim();
    }
  }
  const map = new Map(), used = new Set();
  const groups = new Map();
  for (const o of ops) {
    const key = o.tag || o.path.split('/').filter(Boolean)[0] || 'root';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  const nodes = [{ id: 'client', label: 'Client', kind: 'external' }, { id: 'api', label: clean(title || 'API', 40), focal: true }];
  const edges = [['client', 'api', 'HTTPS', 'link']];
  for (const [tag, list] of groups) {
    const id = safeId(tag.toLowerCase(), map, new Set(['client', 'api', ...used]));
    const methods = [...new Set(list.map((o) => o.method))].join(' ');
    nodes.push({ id, label: clean(tag, 40), sub: clean(`${list.length} ops · ${methods}`, 48) });
    edges.push(['api', id]);
  }
  return { kind: 'graph', hint: 'architecture', title, dir: 'LR', nodes, edges, ops: ops.length };
}
