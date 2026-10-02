// PlantUML → model: sequence, class, state, component/deployment/usecase
// (generic graph), activity (flowchart), mindmap/wbs (tree), gantt (basic).
import { clean, safeId } from './common.mjs';

function body(src) {
  const m = src.match(/@start(\w+)[^\n]*\n([\s\S]*?)@end\1/);
  return { flavor: m ? m[1] : 'uml', lines: (m ? m[2] : src).replace(/\r/g, '').split('\n').map((l) => l.replace(/^\s*'.*$/, '').trim()).filter(Boolean) };
}

export function parsePlantUml(src) {
  const { flavor, lines } = body(src);
  const title = (lines.find((l) => /^title\s+/i.test(l)) || '').replace(/^title\s+/i, '') || undefined;
  if (flavor === 'mindmap' || flavor === 'wbs') return tree(lines, title);
  if (flavor === 'gantt') return gantt(lines, title);
  const joined = lines.join('\n');
  const componentish = /^\s*(package|node|component|cloud|frame|folder|rectangle|usecase)\b/m.test(joined) || /^\s*\[[^\]]+\]/m.test(joined) || /\[[^\]*][^\]]*\]\s*(as\s+\w+)?\s*$/m.test(joined);
  if (!componentish && /^\s*(participant|actor|boundary|control|entity|database|collections|queue)\s/m.test(joined) && /->|-->/.test(joined) && !/^\s*class\s/m.test(joined) && !/^\s*\[\*\]/m.test(joined)) return sequence(lines, title);
  if (/^\s*(abstract\s+)?(class|interface|enum)\s/m.test(joined)) return classes(lines, title);
  if (/\[\*\]/.test(joined)) return states(lines, title);
  if (/^\s*:[^;]+;/m.test(joined) || /^\s*start\s*$/m.test(joined)) return activity(lines, title);
  if (!componentish && /->/.test(joined) && !/[[\](]/.test(joined.replace(/\[[^\]]*\]/g, ''))) return sequence(lines, title);
  return components(lines, title);
}

function sequence(lines, title) {
  const map = new Map(), used = new Set();
  const parts = new Map();
  const messages = [], fragments = [], notes = [];
  const open = [];
  const part = (raw, label, kind) => {
    const name = raw.replace(/"/g, '').trim();
    const id = safeId(name, map, used);
    if (!parts.has(id)) parts.set(id, { id, label: clean(label || name, 32), kind });
    return id;
  };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+("?[^"]+"?|\S+)(?:\s+as\s+(\S+))?/))) {
      const kind = m[1] === 'actor' ? 'external' : /database|queue|collections/.test(m[1]) ? 'store' : undefined;
      if (m[3]) part(m[3], m[2].replace(/"/g, ''), kind);
      else part(m[2], undefined, kind);
      continue;
    }
    if ((m = l.match(/^(alt|opt|loop|par|critical|break|group)\s*(.*)$/))) { open.push({ kind: m[1] === 'group' ? 'opt' : m[1], label: clean(m[2], 40), from: messages.length }); continue; }
    if ((m = l.match(/^else\s*(.*)$/)) && open.length) { open[open.length - 1].else = messages.length; open[open.length - 1].elseLabel = clean(m[1], 40) || undefined; continue; }
    if (l === 'end' && open.length) { const f = open.pop(); if (messages.length > f.from) fragments.push({ ...f, to: messages.length - 1 }); continue; }
    if ((m = l.match(/^note\s+(?:over|left of|right of)\s+([^:]+):\s*(.+)$/i))) { notes.push({ at: messages.length, over: m[1].split(',').map((s) => part(s)).slice(0, 2), text: clean(m[2], 80) }); continue; }
    if ((m = l.match(/^("?[^"\s-<>]+"?)\s*(<?-{1,2}(?:\[[^\]]*\])?>{1,2}|<-{1,2})\s*("?[^":\s]+"?)\s*(?::\s*(.*))?$/))) {
      let a = part(m[1]), b = part(m[3]);
      if (m[2].startsWith('<')) [a, b] = [b, a];
      const reply = m[2].includes('--');
      messages.push([a, b, clean(m[4] || '', 44), ...(reply ? ['reply'] : m[2].includes('>>') ? ['async'] : [])]);
    }
  }
  return { kind: 'sequence', title, participants: [...parts.values()], messages, fragments, notes };
}

const REL = [['<|--', 'extends', true], ['--|>', 'extends'], ['<|..', 'implements', true], ['..|>', 'implements'], ['*--', 'composes'], ['--*', 'composes', true], ['o--', 'aggregates'], ['--o', 'aggregates', true], ['..>', 'depends'], ['<..', 'depends', true], ['-->', 'assoc'], ['<--', 'assoc', true], ['--', 'assoc'], ['..', 'depends']];

function classes(lines, title) {
  const map = new Map(), used = new Set();
  const cls = new Map();
  const edges = [];
  let cur = null;
  const ensure = (raw, tag) => {
    const name = raw.replace(/["<>]/g, '').replace(/\s+as\s+.*/, '').trim();
    const id = safeId(name, map, used);
    if (!cls.has(id)) cls.set(id, { id, label: clean(name), attrs: [], methods: [], ...(tag ? { tag } : {}) });
    return id;
  };
  for (const l of lines) {
    let m;
    if (cur && l === '}') { cur = null; continue; }
    if (cur) { if (!/^(--|==|\.\.)/.test(l)) (l.includes('(') ? cls.get(cur).methods : cls.get(cur).attrs).push(clean(l, 48)); continue; }
    if ((m = l.match(/^(abstract\s+class|abstract|class|interface|enum)\s+("[^"]+"|[\w.]+)(?:\s*<<\s*(\w+)\s*>>)?.*?(\{)?$/))) {
      const tag = /interface/.test(m[1]) ? '«interface»' : /enum/.test(m[1]) ? '«enum»' : /abstract/.test(m[1]) ? '«abstract»' : m[3] ? `«${m[3]}»` : undefined;
      const id = ensure(m[2], tag);
      if (m[4]) cur = id;
      continue;
    }
    for (const [op, kind, rev] of REL) {
      const i = l.indexOf(op);
      if (i < 0) continue;
      const left = l.slice(0, i).replace(/"[^"]*"\s*$/, '').trim();
      const [rhsRaw, lab] = l.slice(i + op.length).split(':');
      const rhs = rhsRaw.replace(/^\s*"[^"]*"/, '').trim();
      if (!left || !rhs) break;
      const a = ensure(left), b = ensure(rhs);
      edges.push(rev ? { from: b, to: a, kind, label: lab ? clean(lab, 28) : undefined } : { from: a, to: b, kind, label: lab ? clean(lab, 28) : undefined });
      break;
    }
  }
  return { kind: 'graph', hint: 'uml-class', title, dir: 'TB', nodes: [...cls.values()].map((c) => ({ ...c, attrs: c.attrs.slice(0, 8), methods: c.methods.slice(0, 8) })), edges };
}

function states(lines, title) {
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  let s = 0, e = 0;
  const ensure = (raw) => {
    const id = safeId(raw, map, used);
    if (!nodes.has(id)) nodes.set(id, { id, label: clean(raw) });
    return id;
  };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^state\s+"([^"]+)"\s+as\s+(\w+)/))) { ensure(m[2]); nodes.get(map.get(m[2])).label = clean(m[1]); continue; }
    if ((m = l.match(/^(\[\*\]|[\w.]+)\s*-+(?:\[[^\]]*\])?(?:left|right|up|down)?-*>\s*(\[\*\]|[\w.]+)\s*(?::\s*(.*))?$/))) {
      const a = m[1] === '[*]' ? `start${s++ || ''}` : ensure(m[1]);
      const b = m[2] === '[*]' ? `end${e++ || ''}` : ensure(m[2]);
      if (m[1] === '[*]') nodes.set(a, { id: a, shape: 'start' });
      if (m[2] === '[*]') nodes.set(b, { id: b, shape: 'end' });
      edges.push({ from: a, to: b, label: m[3] ? clean(m[3], 28) : undefined });
    }
  }
  return { kind: 'graph', hint: 'state', title, dir: 'LR', nodes: [...nodes.values()], edges };
}

function activity(lines, title) {
  const nodes = [];
  const edges = [];
  let prev = [];
  let n = 0;
  const stack = [];
  const add = (label, shape, kind) => {
    const id = `a${n++}`;
    nodes.push({ id, label: clean(label), ...(shape ? { shape } : {}), ...(kind ? { kind } : {}) });
    return id;
  };
  const link = (to, label) => {
    for (const p of prev) edges.push({ from: p.id, to, ...(p.label || label ? { label: clean(p.label || label, 28) } : {}) });
    prev = [{ id: to }];
  };
  for (const l of lines) {
    let m;
    if (/^start$/.test(l)) { link(add('Start', 'terminal')); continue; }
    if (/^(stop|end)$/.test(l)) { link(add('End', 'terminal')); continue; }
    if ((m = l.match(/^:(.+?);$/))) { link(add(m[1])); continue; }
    if ((m = l.match(/^if\s*\((.+?)\)\s*then\s*(?:\((.+?)\))?/))) {
      const d = add(`${m[1]}?`, 'decision');
      link(d);
      stack.push({ d, ends: [], elseLabel: undefined });
      prev = [{ id: d, label: m[2] || 'yes' }];
      continue;
    }
    if ((m = l.match(/^(?:else\s*if|elseif)\s*\((.+?)\)/)) && stack.length) { const top = stack[stack.length - 1]; top.ends.push(...prev); prev = [{ id: top.d, label: m[1] }]; continue; }
    if ((m = l.match(/^else\s*(?:\((.+?)\))?/)) && stack.length) { const top = stack[stack.length - 1]; top.ends.push(...prev); prev = [{ id: top.d, label: m[1] || 'no' }]; continue; }
    if (/^endif$/.test(l) && stack.length) { const top = stack.pop(); prev = [...top.ends, ...prev]; continue; }
  }
  return { kind: 'graph', hint: 'flowchart', title, dir: 'TB', nodes, edges };
}

function components(lines, title) {
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  const groups = [];
  const stack = [];
  const ensure = (raw, kind, label) => {
    const name = raw.replace(/^[[(]|[\])]$/g, '').replace(/"/g, '').trim();
    const id = safeId(name, map, used);
    if (!nodes.has(id)) nodes.set(id, { id, label: clean(label || name), ...(kind ? { kind } : {}), ...(stack.length ? { group: stack[stack.length - 1] } : {}) });
    return id;
  };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^(package|node|cloud|frame|folder|rectangle|namespace)\s+("?[^"{]+"?)(?:\s+as\s+(\w+))?\s*\{$/))) {
      const gid = safeId(`g_${(m[3] || m[2]).replace(/"/g, '')}`, map, used);
      groups.push({ id: gid, label: clean(m[2].replace(/"/g, ''), 32) });
      stack.push(gid);
      continue;
    }
    if (l === '}') { stack.pop(); continue; }
    if ((m = l.match(/^(component|database|queue|actor|usecase|interface|node|cloud|storage|artifact|boundary|agent|person)\s+("[^"]+"|\[[^\]]+\]|\([^)]+\)|\S+)(?:\s+as\s+(\w+))?/))) {
      const kind = /database|queue|storage/.test(m[1]) ? 'store' : /actor|person|cloud/.test(m[1]) ? 'external' : undefined;
      const label = m[2].replace(/^["[(]|["\])]$/g, '');
      ensure(m[3] || m[2], kind, label);
      continue;
    }
    if ((m = l.match(/^("[^"]+"|\[[^\]]+\]|\([^)]+\)|[\w.]+)\s*(<?[-.]+(?:\[[^\]]*\])?(?:left|right|up|down)?[-.]*>?)\s*("[^"]+"|\[[^\]]+\]|\([^)]+\)|[\w.]+)\s*(?::\s*(.*))?$/))) {
      const a = ensure(m[1]), b = ensure(m[3]);
      const rev = m[2].startsWith('<') && !m[2].endsWith('>');
      edges.push({ from: rev ? b : a, to: rev ? a : b, label: m[4] ? clean(m[4], 28) : undefined, kind: m[2].includes('.') ? 'async' : undefined });
    }
  }
  return { kind: 'graph', hint: groups.length ? 'deployment' : 'architecture', title, dir: 'LR', nodes: [...nodes.values()], edges, groups };
}

function tree(lines, title) {
  const root = { children: [] };
  const stack = [{ depth: 0, node: root }];
  for (const l of lines) {
    const m = l.match(/^([*+-]+)[_]?\s*(.+)$/);
    if (!m) continue;
    const depth = m[1].length;
    const n = { label: clean(m[2].replace(/^\[#\w+\]\s*/, ''), 36), children: [] };
    while (stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].node.children.push(n);
    stack.push({ depth, node: n });
  }
  const strip = (n) => ({ label: n.label, ...(n.children.length ? { children: n.children.map(strip) } : {}) });
  const top = root.children[0] || { label: title || 'Root', children: [] };
  return { kind: 'tree', title: title || top.label, root: strip(top) };
}

function gantt(lines, title) {
  const tasks = [];
  const ids = new Map();
  let start;
  let n = 0;
  for (const l of lines) {
    let m;
    if ((m = l.match(/^project starts\s+(?:the\s+)?(\d{4}-\d{2}-\d{2})/i))) { start = m[1]; continue; }
    if ((m = l.match(/^\[([^\]]+)\]\s+(?:as\s+\[(\w+)\]\s+)?(?:requires|lasts)\s+(\d+)\s+(day|week)s?/i))) {
      const id = `t${n++}`;
      ids.set(m[1], id);
      if (m[2]) ids.set(m[2], id);
      tasks.push({ id, label: clean(m[1], 36), days: Number(m[3]) * (/week/i.test(m[4]) ? 7 : 1) });
      continue;
    }
    if ((m = l.match(/^\[([^\]]+)\]\s+starts\s+at\s+\[([^\]]+)\]'s\s+end/i))) { const t = tasks.find((x) => x.id === ids.get(m[1])); if (t && ids.get(m[2])) t.after = ids.get(m[2]); }
  }
  tasks.forEach((t, i) => { if (!t.after && i === 0) t.start = start || '2026-01-01'; else if (!t.after && i > 0) t.after = tasks[i - 1].id; });
  return { kind: 'gantt', title, tasks };
}
