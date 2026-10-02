// Mermaid → SeeCode model. Covers flowchart/graph, sequence, state, er,
// class, gantt, pie, mindmap, journey, timeline, quadrant, sankey, xychart,
// gitGraph, block, C4 and architecture diagrams.
import { clean, safeId } from './common.mjs';

const SHAPES = [
  [/^\(\[(.*)\]\)$/, 'terminal'], [/^\[\((.*)\)\]$/, 'store'], [/^\(\((.*)\)\)$/, 'terminal'],
  [/^\{\{(.*)\}\}$/, 'box'], [/^\{(.*)\}$/, 'decision'], [/^\[\/(.*)\/\]$/, 'io'], [/^\[\\(.*)\\\]$/, 'io'],
  [/^\[\/(.*)\\\]$/, 'io'], [/^\[(.*)\]$/, 'box'], [/^\((.*)\)$/, 'box'], [/^>(.*)\]$/, 'box'],
];

function unquote(s) {
  const t = s.trim();
  return /^".*"$/.test(t) ? t.slice(1, -1) : t;
}

function lines(src) {
  return src.replace(/\r/g, '').split('\n').map((l) => l.replace(/%%.*$/, '').trim()).filter(Boolean);
}

export function detectMermaid(src) {
  const body = src.replace(/^---[\s\S]*?---\s*/, '');
  const first = lines(body)[0] || '';
  return first.split(/\s+/)[0];
}

export function parseMermaid(src) {
  const body = src.replace(/^---[\s\S]*?---\s*/, '');
  const L = lines(body);
  const head = (L[0] || '').split(/\s+/)[0];
  const rest = L.slice(1);
  const title = (body.match(/^\s*title[:\s]+(.+)$/m) || [])[1];
  switch (head) {
    case 'flowchart': case 'graph': return flow(L, title);
    case 'sequenceDiagram': return sequence(rest, title);
    case 'stateDiagram': case 'stateDiagram-v2': return state(rest, title);
    case 'erDiagram': return er(rest, title);
    case 'classDiagram': case 'classDiagram-v2': return classes(rest, title);
    case 'gantt': return gantt(rest, title);
    case 'pie': return pie(L, title);
    case 'mindmap': return mindmap(body);
    case 'journey': return journey(rest, title);
    case 'timeline': return timeline(rest, title);
    case 'quadrantChart': return quadrant(rest, title);
    case 'sankey-beta': case 'sankey': return sankey(rest, title);
    case 'xychart-beta': case 'xychart': return xychart(rest, title);
    case 'gitGraph': return gitgraph(rest, title);
    case 'block-beta': case 'block': return block(rest, title);
    case 'architecture-beta': case 'architecture': return architecture(rest, title);
    default:
      if (/^C4/.test(head)) return c4(rest, title);
      return { error: `unsupported Mermaid diagram "${head}"` };
  }
}

function flow(L, title) {
  const dirTok = (L[0].split(/\s+/)[1] || 'TD').toUpperCase();
  const dir = dirTok === 'LR' || dirTok === 'RL' ? 'LR' : 'TB';
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  const groups = [];
  const stack = [];
  let soloLine = false;
  const node = (tok) => {
    const m = tok.trim().match(/^([^\s[({>]+)\s*(.*)$/);
    if (!m) return null;
    const raw = m[1].replace(/:::.*$/, '');
    const id = safeId(raw, map, used);
    let label, shape;
    if (m[2]) {
      for (const [re, sh] of SHAPES) {
        const mm = m[2].trim().match(re);
        if (mm) { label = unquote(mm[1]); shape = sh; break; }
      }
    }
    const extra = shape === 'store' ? { kind: 'store' } : {};
    if (!nodes.has(id)) nodes.set(id, { id, label: clean(label || raw), shape: shape && shape !== 'box' ? shape : undefined, group: stack[stack.length - 1], ...extra });
    else {
      const n = nodes.get(id);
      if (label) Object.assign(n, { label: clean(label), ...(shape && shape !== 'box' ? { shape } : {}), ...extra });
      // a bare id listed inside a subgraph joins that group
      if (!n.group && stack.length && soloLine) n.group = stack[stack.length - 1];
    }
    return id;
  };
  const LINK = /\s*(<?(?:-->|---|-\.->|-\.-|==>|===|--[ox]|<-->|~~~)|--\s+.+?\s*-->|==\s+.+?\s*==>|-\.\s+.+?\s*\.->)\s*(?:\|([^|]*)\|)?\s*/;
  for (const line of L.slice(1)) {
    if (/^(classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue;
    let m;
    if ((m = line.match(/^subgraph\s+(.+)$/))) {
      const t = m[1].trim();
      const mm = t.match(/^([^\s[]+)\s*\[(.*)\]$/);
      const gid = safeId(`g_${mm ? mm[1] : t}`, map, used);
      groups.push({ id: gid, label: clean(unquote(mm ? mm[2] : t), 32) });
      stack.push(gid);
      continue;
    }
    if (line === 'end') { stack.pop(); continue; }
    // split a chain "A --> B -- text --> C & D"
    soloLine = !LINK.test(line);
    const parts = [];
    let restL = line;
    for (;;) {
      const mm = restL.match(LINK);
      if (!mm) { parts.push({ node: restL }); break; }
      parts.push({ node: restL.slice(0, mm.index) });
      let lab = mm[2];
      const inline = mm[1].match(/^(?:--|==|-\.)\s*(.+?)\s*(?:-->|==>|\.->)$/);
      if (!lab && inline) lab = inline[1];
      parts.push({ link: mm[1], label: lab });
      restL = restL.slice(mm.index + mm[0].length);
    }
    let prev = null;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].node === undefined) continue;
      const ids = parts[i].node.split(/\s*&\s*/).map((t) => t && node(t)).filter(Boolean);
      if (prev && parts[i - 1]?.link) {
        const lk = parts[i - 1].link;
        const kind = /-\./.test(lk) ? 'async' : /==/.test(lk) ? 'primary' : /~~~|---|===/.test(lk) && !/>/.test(lk) ? 'muted' : undefined;
        for (const a of prev) for (const b of ids) edges.push({ from: a, to: b, label: parts[i - 1].label ? clean(unquote(parts[i - 1].label), 28) : undefined, kind, both: /^</.test(lk) || undefined });
      }
      prev = ids;
    }
  }
  return { kind: 'graph', hint: 'flowchart', title, dir, nodes: [...nodes.values()], edges, groups };
}

function sequence(L, title) {
  const map = new Map(), used = new Set();
  const parts = new Map();
  const messages = [], fragments = [], notes = [];
  const open = [];
  let numbered = false;
  const part = (raw, label, kind) => {
    const id = safeId(raw.trim(), map, used);
    if (!parts.has(id)) parts.set(id, { id, label: clean(label || raw, 32), kind });
    return id;
  };
  for (const line of L) {
    let m;
    if ((m = line.match(/^(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/))) { part(m[2], m[3] || m[2], m[1] === 'actor' ? 'external' : undefined); continue; }
    if (/^autonumber/.test(line)) { numbered = true; continue; }
    if ((m = line.match(/^(alt|opt|loop|par|critical|break)\s*(.*)$/))) { open.push({ kind: m[1], label: clean(m[2], 40), from: messages.length }); continue; }
    if ((m = line.match(/^(else|and|option)\s*(.*)$/)) && open.length) { open[open.length - 1].else = messages.length; open[open.length - 1].elseLabel = clean(m[2], 40) || undefined; continue; }
    if (line === 'end' && open.length) { const f = open.pop(); if (messages.length > f.from) fragments.push({ ...f, to: messages.length - 1 }); continue; }
    if ((m = line.match(/^Note\s+(?:over|left of|right of)\s+([^:]+):\s*(.*)$/i))) { notes.push({ at: messages.length, over: m[1].split(',').map((s) => part(s.trim())).slice(0, 2), text: clean(m[2], 80) }); continue; }
    if ((m = line.match(/^([^-+<>)x\s][^-<>]*?)\s*(--?>>|--?>|--?x|--?\)|-)\s*([+-]?)([^:]+):\s*(.*)$/))) {
      const from = part(m[1]), to = part(m[4]);
      const arrow = m[2];
      const kind = from === to ? 'self' : arrow.startsWith('--') ? 'reply' : /\)/.test(arrow) ? 'async' : undefined;
      messages.push([from, to, clean(m[5], 44), ...(kind && kind !== 'self' ? [kind] : [])]);
    }
  }
  return { kind: 'sequence', title, participants: [...parts.values()], messages, fragments, notes, numbered };
}

function state(L, title) {
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  const ensure = (raw) => {
    if (raw === '[*]') return null;
    const id = safeId(raw, map, used);
    if (!nodes.has(id)) nodes.set(id, { id, label: clean(raw) });
    return id;
  };
  let startN = 0, endN = 0;
  for (const line of L) {
    let m;
    if ((m = line.match(/^state\s+"([^"]+)"\s+as\s+(\S+)/))) { const id = ensure(m[2]); nodes.get(id).label = clean(m[1]); continue; }
    if ((m = line.match(/^(\S+)\s*:\s*(.+)$/)) && !line.includes('-->')) { const id = ensure(m[1]); if (id) nodes.get(id).sub = clean(m[2], 40); continue; }
    if ((m = line.match(/^(\S+)\s*-->\s*(\S+)\s*(?::\s*(.*))?$/))) {
      let a = m[1] === '[*]' ? `__start${startN++ ? startN : ''}` : ensure(m[1]);
      let b = m[2] === '[*]' ? `__end${endN++ ? endN : ''}` : ensure(m[2]);
      if (m[1] === '[*]') nodes.set(a, { id: a, shape: 'start' });
      if (m[2] === '[*]') nodes.set(b, { id: b, shape: 'end' });
      edges.push({ from: a, to: b, label: m[3] ? clean(m[3], 28) : undefined });
    }
  }
  return { kind: 'graph', hint: 'state', title, dir: 'LR', nodes: [...nodes.values()].map((n) => ({ ...n, id: n.id.replace(/^__/, '') })), edges: edges.map((e) => ({ ...e, from: e.from.replace(/^__/, ''), to: e.to.replace(/^__/, '') })) };
}


function er(L, title) {
  const map = new Map(), used = new Set();
  const ents = new Map();
  const edges = [];
  let cur = null;
  const ent = (raw) => {
    const id = safeId(raw.toLowerCase(), map, used);
    if (!ents.has(id)) ents.set(id, { id, label: clean(raw.replace(/["`]/g, '')), fields: [] });
    return id;
  };
  for (const line of L) {
    let m;
    if (cur && line === '}') { cur = null; continue; }
    if (cur) {
      const f = line.split(/\s+/);
      if (f.length >= 2) ents.get(cur).fields.push(clean(`${f[1]} ${f[0]}${f.slice(2).filter((t) => /^(PK|FK|UK)$/.test(t)).map((t) => ` ${t === 'UK' ? 'UQ' : t}`).join('')}`, 48));
      continue;
    }
    if ((m = line.match(/^([\w-]+)\s*\{$/))) { cur = ent(m[1]); continue; }
    if ((m = line.match(/^([\w-]+)\s+([|}][|o])(--|\.\.)([|o][|{])\s+([\w-]+)\s*:\s*(.*)$/))) {
      const a = ent(m[1]), b = ent(m[5]);
      const l = m[2].startsWith('}') ? 'many' : 'one';
      const r = m[4].endsWith('{') ? (m[4].startsWith('o') ? 'zero-many' : 'many') : 'one';
      const kind = r === 'zero-many' ? 'zero-many' : `${l}-${r}`;
      edges.push({ from: a, to: b, label: clean(m[6].replace(/"/g, ''), 28) || undefined, kind: ['one-one', 'one-many', 'many-one', 'many-many', 'zero-many'].includes(kind) ? kind : 'one-many' });
    }
  }
  return { kind: 'graph', hint: 'er', title, dir: 'LR', nodes: [...ents.values()].map((e) => ({ ...e, fields: e.fields.slice(0, 12) })), edges };
}

const REL = [['<|--', 'extends', true], ['--|>', 'extends'], ['..|>', 'implements'], ['<|..', 'implements', true], ['*--', 'composes'], ['--*', 'composes', true], ['o--', 'aggregates'], ['--o', 'aggregates', true], ['..>', 'depends'], ['<..', 'depends', true], ['-->', 'assoc'], ['--', 'assoc'], ['..', 'depends']];

function classes(L, title) {
  const map = new Map(), used = new Set();
  const cls = new Map();
  const edges = [];
  let cur = null;
  const ensure = (raw) => {
    const name = raw.replace(/~.*~/, '').replace(/["`]/g, '').trim();
    const id = safeId(name, map, used);
    if (!cls.has(id)) cls.set(id, { id, label: clean(name), attrs: [], methods: [] });
    return id;
  };
  for (const line of L) {
    let m;
    if (cur && line === '}') { cur = null; continue; }
    if (cur) {
      if (/^<<.*>>$/.test(line)) { cls.get(cur).tag = clean(line.replace(/[<>]/g, (c) => (c === '<' ? '«' : '»')).replace(/««/, '«').replace(/»»/, '»'), 16); continue; }
      (line.includes('(') ? cls.get(cur).methods : cls.get(cur).attrs).push(clean(line, 48));
      continue;
    }
    if ((m = line.match(/^class\s+([^{\s]+)\s*\{?$/))) { const id = ensure(m[1]); if (line.endsWith('{')) cur = id; continue; }
    if ((m = line.match(/^([\w~]+)\s*:\s*(.+)$/)) && !REL.some(([op]) => line.includes(op))) { const id = ensure(m[1]); (m[2].includes('(') ? cls.get(id).methods : cls.get(id).attrs).push(clean(m[2], 48)); continue; }
    for (const [op, kind, rev] of REL) {
      const i = line.indexOf(op);
      if (i < 0) continue;
      const left = line.slice(0, i).replace(/"[^"]*"\s*$/, '').trim();
      const right = line.slice(i + op.length).replace(/^\s*"[^"]*"/, '');
      const [rhs, lab] = right.split(':');
      const a = ensure(left), b = ensure(rhs.trim());
      edges.push(rev ? { from: b, to: a, kind, label: lab ? clean(lab, 28) : undefined } : { from: a, to: b, kind, label: lab ? clean(lab, 28) : undefined });
      break;
    }
  }
  return { kind: 'graph', hint: 'uml-class', title, dir: 'TB', nodes: [...cls.values()].map((c) => ({ ...c, attrs: c.attrs.slice(0, 8), methods: c.methods.slice(0, 8) })), edges };
}

function gantt(L, title) {
  const tasks = [], milestones = [];
  let section;
  let auto = 0;
  for (const line of L) {
    let m;
    if (/^(title|dateFormat|axisFormat|excludes|todayMarker|tickInterval|weekday)\b/.test(line)) continue;
    if ((m = line.match(/^section\s+(.+)$/))) { section = clean(m[1], 24); continue; }
    if ((m = line.match(/^([^:]+):\s*(.+)$/))) {
      const label = clean(m[1], 36);
      const toks = m[2].split(',').map((t) => t.trim());
      const flags = new Set(toks.filter((t) => /^(done|active|crit|milestone)$/.test(t)));
      const rest = toks.filter((t) => !flags.has(t));
      let id, start, after, days, end;
      for (const t of rest) {
        if (/^after\s+/.test(t)) after = t.replace(/^after\s+/, '').split(/\s+/)[0];
        else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) (start ? (end = t) : (start = t));
        else if (/^\d+(\.\d+)?[dw]$/.test(t)) days = parseFloat(t) * (t.endsWith('w') ? 7 : 1);
        else if (/^\d+h$/.test(t)) days = parseFloat(t) / 24;
        else if (/^[A-Za-z_][\w-]*$/.test(t) && !id) id = t;
      }
      id = id || `t${auto++}`;
      if (flags.has('milestone')) { milestones.push({ label, date: start }); continue; }
      tasks.push({ id, label, ...(section ? { section } : {}), ...(start ? { start } : {}), ...(after ? { after } : {}), ...(end ? { end } : {}), ...(days !== undefined ? { days } : !end ? { days: 1 } : {}), ...(flags.has('done') ? { done: true } : {}), ...(flags.has('crit') ? { focal: true } : {}) });
    }
  }
  return { kind: 'gantt', title, tasks, milestones: milestones.filter((m) => m.date) };
}

function pie(L, title) {
  const data = [];
  for (const line of L) {
    const m = line.match(/^"([^"]+)"\s*:\s*([\d.]+)/);
    if (m) data.push([clean(m[1], 32), Number(m[2])]);
  }
  const t = (L[0].match(/title\s+(.+)$/) || [])[1] || title;
  return { kind: 'chart', hint: 'bar', title: t, data: data.sort((a, b) => b[1] - a[1]), note: 'pie redrawn as a sorted bar (more precise to read)' };
}

function mindmap(body) {
  const raw = body.replace(/\r/g, '').split('\n').filter((l) => l.trim() && !/^\s*mindmap\s*$/.test(l) && !/^\s*%%/.test(l));
  const root = { children: [] };
  const stack = [{ indent: -1, node: root }];
  for (const l of raw) {
    const indent = l.match(/^\s*/)[0].length;
    let text = l.trim().replace(/::icon\(.*\)/, '');
    const m = text.match(/^[\w-]*\s*(?:\(\((.*)\)\)|\((.*)\)|\[(.*)\]|\{\{(.*)\}\}|\)(.*)\(|(.*))$/);
    text = clean((m && (m[1] || m[2] || m[3] || m[4] || m[5] || m[6])) || text, 36);
    const n = { label: text, children: [] };
    while (stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].node.children.push(n);
    stack.push({ indent, node: n });
  }
  const top = root.children[0] || { label: 'Root', children: [] };
  const strip = (n) => ({ label: n.label, ...(n.children.length ? { children: n.children.map(strip) } : {}) });
  return { kind: 'tree', title: top.label, root: strip(top) };
}

function journey(L, title) {
  const stages = [];
  for (const line of L) {
    let m;
    if (/^title\b/.test(line)) continue;
    if ((m = line.match(/^section\s+(.+)$/))) { stages.push({ label: clean(m[1], 24), steps: [] }); continue; }
    if ((m = line.match(/^([^:]+):\s*(\d)\s*(?::.*)?$/))) {
      if (!stages.length) stages.push({ label: 'Journey', steps: [] });
      const score = Math.round(((Number(m[2]) - 3) / 2) * 2) / 1;
      stages[stages.length - 1].steps.push({ label: clean(m[1], 40), score: Math.max(-2, Math.min(2, score)) });
    }
  }
  return { kind: 'journey', title, stages };
}

function timeline(L, title) {
  const events = [];
  const periods = [];
  for (const line of L) {
    let m;
    if (/^title\b/.test(line)) continue;
    if ((m = line.match(/^section\s+(.+)$/))) { periods.push(clean(m[1], 32)); continue; }
    if ((m = line.match(/^([^:]+?)\s*:\s*(.+)$/))) {
      const items = m[2].split(/\s*:\s*/);
      events.push({ date: /^\d{4}(-\d{2}(-\d{2})?)?$/.test(m[1].trim()) ? m[1].trim() : undefined, when: clean(m[1], 24), label: clean(items[0], 32), ...(items[1] ? { sub: clean(items.slice(1).join(', '), 40) } : {}) });
    }
  }
  if (events.some((e) => !e.date)) events.forEach((e) => delete e.date);
  return { kind: 'timeline', title, events };
}

function quadrant(L, title) {
  const q = {};
  const items = [];
  const x = {}, y = {};
  for (const line of L) {
    let m;
    if ((m = line.match(/^x-axis\s+(.+?)(?:\s+-->\s+(.+))?$/))) { x.low = clean(m[1], 20); if (m[2]) x.high = clean(m[2], 20); continue; }
    if ((m = line.match(/^y-axis\s+(.+?)(?:\s+-->\s+(.+))?$/))) { y.low = clean(m[1], 20); if (m[2]) y.high = clean(m[2], 20); continue; }
    if ((m = line.match(/^quadrant-([1-4])\s+(.+)$/))) { q[m[1]] = clean(m[2], 32); continue; }
    if ((m = line.match(/^(.+?):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/))) items.push({ label: clean(m[1], 28), x: Number(m[2]), y: Number(m[3]) });
  }
  // mermaid: 1 = top-right, 2 = top-left, 3 = bottom-left, 4 = bottom-right
  return { kind: 'quadrant', title, x, y, quadrants: [q[2] || '', q[1] || '', q[3] || '', q[4] || ''], items };
}

function sankey(L, title) {
  const links = [];
  for (const line of L) {
    const cells = line.match(/("([^"]|"")*"|[^,]+)/g);
    if (!cells || cells.length < 3) continue;
    const v = Number(cells[2]);
    if (!isNaN(v)) links.push([clean(unquote(cells[0]).replace(/""/g, '"'), 28), clean(unquote(cells[1]).replace(/""/g, '"'), 28), v]);
  }
  return { kind: 'sankey', title, links };
}

function xychart(L, title) {
  let xs = [];
  const bars = [], lns = [];
  for (const line of L) {
    let m;
    if ((m = line.match(/^x-axis\s*(?:"[^"]*"\s*)?\[(.+)\]/))) xs = m[1].split(',').map((s) => clean(unquote(s), 20));
    else if ((m = line.match(/^bar\s*(?:"([^"]*)"\s*)?\[(.+)\]/))) bars.push({ name: m[1] || `bar ${bars.length + 1}`, values: m[2].split(',').map(Number) });
    else if ((m = line.match(/^line\s*(?:"([^"]*)"\s*)?\[(.+)\]/))) lns.push({ name: m[1] || `line ${lns.length + 1}`, values: m[2].split(',').map(Number) });
  }
  if (!xs.length) xs = (bars[0] || lns[0] || { values: [] }).values.map((_, i) => String(i + 1));
  if (lns.length && !bars.length) return { kind: 'chart', hint: 'line', title, x: xs, series: lns };
  if (bars.length === 1) return { kind: 'chart', hint: 'bar', title, data: xs.map((x, i) => [x, bars[0].values[i]]) };
  return { kind: 'chart', hint: 'bar', title, categories: xs, series: [...bars, ...lns].slice(0, 5) };
}

function gitgraph(L, title) {
  const events = [];
  let branch = 'main';
  for (const line of L) {
    let m;
    if ((m = line.match(/^branch\s+(\S+)/))) { branch = m[1]; events.push({ label: `branch ${clean(m[1], 24)}` }); }
    else if ((m = line.match(/^checkout\s+(\S+)/))) branch = m[1];
    else if ((m = line.match(/^merge\s+(\S+)/))) events.push({ label: `merge ${clean(m[1], 20)} → ${clean(branch, 12)}`, focal: true });
    else if (/^commit/.test(line)) {
      const id = (line.match(/id:\s*"([^"]+)"/) || [])[1];
      const tag = (line.match(/tag:\s*"([^"]+)"/) || [])[1];
      events.push({ label: clean(tag || id || `commit on ${branch}`, 32), sub: clean(branch, 20) });
    }
  }
  return { kind: 'timeline', title, events: events.slice(0, 14) };
}

function block(L, title) {
  const layers = [];
  for (const line of L) {
    if (/^(columns|space|classDef|style|end)\b/.test(line) || line.includes('-->')) continue;
    const items = [...line.matchAll(/([\w-]+)(?:\["([^"]+)"\]|\[([^\]]+)\])?/g)].map((m) => clean(m[2] || m[3] || m[1], 24)).filter((s) => !/^block$/.test(s));
    if (items.length) layers.push({ label: items[0], items: items.slice(1, 7) });
  }
  return { kind: 'layers', title, layers: layers.slice(0, 7) };
}

function architecture(L, title) {
  const map = new Map(), used = new Set();
  const nodes = [], groups = [], edges = [];
  for (const line of L) {
    let m;
    if ((m = line.match(/^group\s+(\S+?)(?:\([^)]*\))?\s*\[([^\]]*)\](?:\s+in\s+(\S+))?/))) { groups.push({ id: safeId(m[1], map, used), label: clean(m[2], 32) }); continue; }
    if ((m = line.match(/^(service|junction)\s+(\S+?)(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?(?:\s+in\s+(\S+))?$/))) {
      const icon = m[3] || '';
      nodes.push({ id: safeId(m[2], map, used), label: clean(m[4] || m[2]), kind: /database|disk/.test(icon) ? 'store' : /internet|cloud/.test(icon) ? 'external' : undefined, group: m[5] ? map.get(m[5]) : undefined });
      continue;
    }
    if ((m = line.match(/^(\S+?)(?:\{group\})?:[LRTB]\s*(<?)-+(>?)\s*[LRTB]:(\S+?)(?:\{group\})?$/))) edges.push({ from: safeId(m[1], map, used), to: safeId(m[4], map, used), both: m[2] && m[3] ? true : undefined });
  }
  return { kind: 'graph', hint: 'architecture', title, dir: 'LR', nodes, edges, groups };
}

function c4(L, title) {
  const map = new Map(), used = new Set();
  const nodes = [], groups = [], edges = [];
  const stack = [];
  const args = (s) => (s.match(/"[^"]*"|[^,]+/g) || []).map((a) => unquote(a.trim()));
  for (const line of L) {
    let m;
    if ((m = line.match(/^(\w*Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary)\s*\((.*)\)\s*\{?$/))) {
      const a = args(m[2]);
      const gid = safeId(`g_${a[0]}`, map, used);
      groups.push({ id: gid, label: clean(a[1] || a[0], 32) });
      stack.push(gid);
      continue;
    }
    if (line === '}') { stack.pop(); continue; }
    if ((m = line.match(/^(Person|Person_Ext|System|System_Ext|SystemDb|SystemDb_Ext|SystemQueue|Container|Container_Ext|ContainerDb|ContainerQueue|Component|ComponentDb)\s*\((.*)\)$/))) {
      const a = args(m[2]);
      const t = m[1];
      const tech = /^(Container|Component)/.test(t) ? a[2] : undefined;
      nodes.push({ id: safeId(a[0], map, used), label: clean(a[1] || a[0]), sub: tech ? clean(tech, 48) : undefined, kind: /Person|_Ext/.test(t) ? 'external' : /Db|Queue/.test(t) ? 'store' : undefined, group: stack[stack.length - 1] });
      continue;
    }
    if ((m = line.match(/^(?:Bi)?Rel\w*\s*\((.*)\)$/))) {
      const a = args(m[1]);
      edges.push({ from: safeId(a[0], map, used), to: safeId(a[1], map, used), label: a[2] ? clean(a[2], 28) : undefined, both: /^BiRel/.test(line) || undefined });
    }
  }
  return { kind: 'graph', hint: groups.length || nodes.some((n) => n.sub) ? 'architecture' : 'high-level', title, dir: 'LR', nodes, edges, groups };
}
