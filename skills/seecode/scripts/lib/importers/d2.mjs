// D2 → model. Supports shapes/labels, containers (→ groups), edges with
// labels and chains, sql_table (→ db-schema) and sequence_diagram.
import { clean, safeId } from './common.mjs';

function stripD2(src) {
  return src.replace(/\r/g, '').replace(/^\s*#.*$/gm, '');
}

export function parseD2(src) {
  const lines = stripD2(src).split('\n');
  const map = new Map(), used = new Set();
  const nodes = new Map();
  const edges = [];
  const groups = [];
  const tables = new Map();
  const containers = [];
  let dir = 'LR';
  let seq = false;
  const pathOf = (raw) => [...containers.map((c) => c.raw), raw.trim()].join('.');
  const ensure = (full, label) => {
    const parts = full.split('.');
    const leaf = parts[parts.length - 1].replace(/^"|"$/g, '');
    const id = safeId(full.replace(/"/g, ''), map, used);
    if (!nodes.has(id)) {
      const parentFull = parts.slice(0, -1).join('.');
      const g = parentFull ? map.get(parentFull.replace(/"/g, '')) : undefined;
      nodes.set(id, { id, label: clean(label || leaf), ...(g ? { group: g } : {}) });
    } else if (label) nodes.get(id).label = clean(label);
    return id;
  };
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i].trim();
    if (!l) continue;
    let m;
    // inline attribute block on a node line: `users: Users { shape: person }`
    const inline = l.match(/^([\w".\- ]+?)\s*:\s*([^{]*?)\s*\{([^{}]*)\}$/);
    if (inline && !/(->|<-|--)/.test(l) && !(containers.length && containers[containers.length - 1].table)) {
      const id = ensure(pathOf(inline[1]), inline[2].replace(/^"|"$/g, '') || undefined);
      const shape = (inline[3].match(/shape:\s*(\w+)/) || [])[1];
      if (shape === 'sql_table' || shape === 'sequence_diagram') { /* handled as containers below */ }
      else {
        if (/cylinder|stored_data|queue/.test(shape || '')) nodes.get(id).kind = 'store';
        else if (/person|cloud/.test(shape || '')) nodes.get(id).kind = 'external';
        else if (/diamond/.test(shape || '')) nodes.get(id).shape = 'decision';
        continue;
      }
    }
    if (l === '}') {
      const c = containers.pop();
      if (c && c.table) continue;
      continue;
    }
    if ((m = l.match(/^direction:\s*(\w+)/))) { dir = /right|left/.test(m[1]) ? 'LR' : 'TB'; continue; }
    if (containers.length && containers[containers.length - 1].table) {
      const t = tables.get(containers[containers.length - 1].id);
      if ((m = l.match(/^([\w"]+)\s*:\s*([^{]+?)(?:\s*\{\s*constraint:\s*\[?\s*([\w_; ]+)\]?\s*\})?$/)) && !/^shape$/.test(m[1])) {
        const key = /primary_key/.test(m[3] || '') ? 'PK' : /foreign_key/.test(m[3] || '') ? 'FK' : /unique/.test(m[3] || '') ? 'UQ' : '';
        t.fields.push([m[1].replace(/"/g, ''), clean(m[2], 24), ...(key ? [key] : [])]);
      }
      continue;
    }
    // edges (possibly chained):  a -> b -> c: label
    if (/(<->|->|<-|--)/.test(l) && !/^[\w"]+\s*:\s*\{/.test(l)) {
      const [lhs, ...labelParts] = l.replace(/\{[^}]*\}\s*$/, '').split(/:(?![^"]*"\s*$)/);
      const label = labelParts.join(':').trim().replace(/^"|"$/g, '');
      const pieces = lhs.split(/\s*(<->|->|<-|--)\s*/);
      for (let k = 2; k < pieces.length; k += 2) {
        const a = ensure(pathOf(pieces[k - 2])), b = ensure(pathOf(pieces[k]));
        const op = pieces[k - 1];
        const e = op === '<-' ? { from: b, to: a } : { from: a, to: b };
        if (op === '<->') e.both = true;
        if (label) e.label = clean(label, 28);
        edges.push(e);
      }
      continue;
    }
    if ((m = l.match(/^([\w".\- ]+?)\s*:\s*(?:"([^"]*)"|([^{]*?))?\s*\{$/))) {
      const full = pathOf(m[1]);
      const label = m[2] ?? m[3];
      // peek for sql_table / sequence shape inside
      const inner = lines.slice(i + 1, i + 4).join('\n');
      if (/shape:\s*sql_table/.test(inner)) {
        const id = safeId(full.replace(/"/g, ''), map, used);
        tables.set(id, { id, label: clean(label || m[1]), fields: [] });
        containers.push({ raw: m[1].trim(), id, table: true });
        continue;
      }
      if (/shape:\s*sequence_diagram/.test(inner)) seq = true;
      const gid = safeId(full.replace(/"/g, ''), map, used);
      groups.push({ id: gid, label: clean(label || m[1], 32) });
      containers.push({ raw: m[1].trim(), id: gid });
      continue;
    }
    if ((m = l.match(/^([\w".\- ]+?)\.shape:\s*(\w+)/))) {
      const id = ensure(pathOf(m[1]));
      if (/cylinder|stored_data/.test(m[2])) nodes.get(id).kind = 'store';
      else if (/diamond/.test(m[2])) nodes.get(id).shape = 'decision';
      else if (/person|cloud/.test(m[2])) nodes.get(id).kind = 'external';
      else if (/queue/.test(m[2])) nodes.get(id).kind = 'store';
      continue;
    }
    if ((m = l.match(/^shape:\s*(\w+)/)) && containers.length) { if (m[1] === 'sequence_diagram') seq = true; continue; }
    if ((m = l.match(/^([\w".\- ]+?)\s*:\s*"?([^"{}]*)"?$/)) && !/^(label|style|icon|near|width|height|link|tooltip)$/.test(m[1])) { ensure(pathOf(m[1]), m[2]); continue; }
    if ((m = l.match(/^([\w".\-]+)$/))) ensure(pathOf(m[1]));
  }
  // groups that never held a node are not groups
  const usedGroups = new Set([...nodes.values()].map((n) => n.group));
  if (tables.size) {
    const fkEdges = edges.map((e) => ({ ...e, kind: 'many-one' }));
    return { kind: 'graph', hint: 'db-schema', dir: 'LR', nodes: [...tables.values()].map((t) => ({ id: t.id, label: t.label, fields: t.fields.slice(0, 12) })), edges: fkEdges.filter((e) => tables.has(e.from.split('.')[0]) || true) };
  }
  if (seq) {
    const parts = [...nodes.values()].map((n) => ({ id: n.id, label: n.label }));
    return { kind: 'sequence', participants: parts, messages: edges.map((e) => [e.from, e.to, e.label || '']) };
  }
  return { kind: 'graph', hint: 'architecture', dir, nodes: [...nodes.values()].filter((n) => !groups.some((g) => g.id === n.id)), edges, groups: groups.filter((g) => usedGroups.has(g.id)) };
}
