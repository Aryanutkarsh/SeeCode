// Graphviz DOT → graph model. Handles digraph/graph, node + edge statements
// with attribute lists, edge chains, subgraph clusters (→ groups), rankdir.
import { clean, safeId } from './common.mjs';

function tokenize(src) {
  const toks = [];
  let i = 0;
  const s = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*#.*$/gm, ' ').replace(/(^|[^:"])\/\/.*$/gm, '$1');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1, out = '';
      while (j < s.length && s[j] !== '"') { if (s[j] === '\\' && s[j + 1]) { out += s[j + 1] === 'n' ? ' ' : s[j + 1]; j += 2; } else out += s[j++]; }
      toks.push({ t: 'id', v: out });
      i = j + 1;
      continue;
    }
    if (c === '<') {
      let depth = 0, j = i;
      do { if (s[j] === '<') depth++; else if (s[j] === '>') depth--; j++; } while (j < s.length && depth > 0);
      toks.push({ t: 'id', v: s.slice(i + 1, j - 1) });
      i = j;
      continue;
    }
    if (s.startsWith('->', i) || s.startsWith('--', i)) { toks.push({ t: 'edge', v: s.slice(i, i + 2) }); i += 2; continue; }
    if ('{}[]=;,:'.includes(c)) { toks.push({ t: c }); i++; continue; }
    const m = s.slice(i).match(/^[A-Za-z0-9_.\u0080-￿-]+/);
    if (m) { toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    i++;
  }
  return toks;
}

export function parseDot(src) {
  const T = tokenize(src);
  let p = 0;
  const peek = (k = 0) => T[p + k] || {};
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  const groups = [];
  let dir = 'TB';
  const node = (raw, attrs = {}) => {
    const id = safeId(raw.split(':')[0], map, used);
    if (!nodes.has(id)) nodes.set(id, { id, label: clean(raw) });
    const n = nodes.get(id);
    if (attrs.label !== undefined) n.label = clean(attrs.label) || n.label;
    if (attrs.shape) {
      if (/diamond/.test(attrs.shape)) n.shape = 'decision';
      else if (/cylinder/.test(attrs.shape)) n.kind = 'store';
      else if (/ellipse|oval|circle/.test(attrs.shape) && attrs.label !== undefined) n.shape = n.shape || undefined;
      else if (/parallelogram/.test(attrs.shape)) n.shape = 'io';
    }
    if (attrs.style && /dashed/.test(attrs.style)) n.kind = 'optional';
    return id;
  };
  const attrList = () => {
    const a = {};
    while (peek().t === '[') {
      p++;
      while (peek().t && peek().t !== ']') {
        if (peek().t === 'id' && peek(1).t === '=') { a[peek().v] = peek(2).v; p += 3; }
        else p++;
        if (peek().t === ',' || peek().t === ';') p++;
      }
      p++;
    }
    return a;
  };
  const graphDirected = /digraph/i.test(src.slice(0, 200));
  const stmts = (group) => {
    while (p < T.length && peek().t !== '}') {
      const tk = peek();
      if (tk.t === ';' || tk.t === ',') { p++; continue; }
      if (tk.t === 'id' && /^(subgraph)$/i.test(tk.v) || tk.t === '{') {
        let name = '';
        if (tk.t === 'id') { p++; if (peek().t === 'id') name = T[p++].v; }
        if (peek().t === '{') p++;
        const isCluster = /^cluster/i.test(name);
        let gid;
        if (isCluster) { gid = safeId(`g_${name.replace(/^cluster_?/i, '') || groups.length}`, map, used); groups.push({ id: gid, label: name.replace(/^cluster_?/i, '') }); }
        stmts(isCluster ? gid : group);
        if (peek().t === '}') p++;
        continue;
      }
      if (tk.t === 'id' && /^(graph|node|edge)$/i.test(tk.v) && peek(1).t === '[') { p++; const a = attrList(); if (/^graph$/i.test(tk.v) && a.rankdir) dir = /LR|RL/i.test(a.rankdir) ? 'LR' : 'TB'; continue; }
      if (tk.t === 'id' && peek(1).t === '=') {
        const k = tk.v, v = peek(2).v;
        p += 3;
        if (k === 'rankdir') dir = /LR|RL/i.test(v) ? 'LR' : 'TB';
        if (k === 'label' && group) { const g = groups.find((x) => x.id === group); if (g) g.label = clean(v, 32); }
        continue;
      }
      if (tk.t === 'id') {
        const chain = [T[p++].v];
        const ops = [];
        while (peek().t === 'edge') { ops.push(T[p++].v); if (peek().t === 'id') chain.push(T[p++].v); else break; }
        const a = attrList();
        if (chain.length === 1) { const id = node(chain[0], a); if (group && !nodes.get(id).group) nodes.get(id).group = group; continue; }
        const ids = chain.map((c) => { const id = node(c); if (group && !nodes.get(id).group) nodes.get(id).group = group; return id; });
        for (let k = 1; k < ids.length; k++) {
          edges.push({ from: ids[k - 1], to: ids[k], label: a.label ? clean(a.label, 28) : undefined, kind: a.style && /dashed|dotted/.test(a.style) ? 'async' : undefined, both: !graphDirected || a.dir === 'both' ? (graphDirected ? true : undefined) : undefined });
        }
        continue;
      }
      p++;
    }
  };
  while (p < T.length && peek().t !== '{') p++;
  p++;
  stmts(null);
  for (const g of groups) if (!g.label) g.label = g.id;
  return { kind: 'graph', hint: 'dependency', dir, nodes: [...nodes.values()], edges, groups: groups.map((g) => ({ ...g, label: clean(g.label, 32) })), undirected: !graphDirected };
}
