// `seecode import <file>`: detect the format, parse it into a model, and write
// a ready-to-render draft spec in the best-fit SeeCode type. Prints a compact
// digest (counts, ids, notes) so the agent can patch layout without reading
// the source or the draft in full.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, extname, dirname, resolve, relative, join } from 'node:path';
import { parseMermaid } from './mermaid.mjs';
import { parseDot } from './dot.mjs';
import { parsePlantUml } from './plantuml.mjs';
import { parseD2 } from './d2.mjs';
import { parseDrawio, parseExcalidraw, extractDrawioXml } from './canvas.mjs';
import { splitUnits } from './units.mjs';
import { slugify } from '../page.mjs';
import { parseStructurizr, parseBpmn, parseSql, parsePrisma, parseDbml, parseOpenApi } from './models.mjs';
import { readTable } from '../data.mjs';
import { clean } from './common.mjs';
import { compactJson, renderSpec } from '../render.mjs';
import { status as configStatus } from '../config/config.mjs';

const MERMAID_HEADS = /^(flowchart|graph|sequenceDiagram|stateDiagram(-v2)?|erDiagram|classDiagram(-v2)?|gantt|pie|mindmap|journey|timeline|quadrantChart|sankey(-beta)?|xychart(-beta)?|gitGraph|block(-beta)?|architecture(-beta)?|C4\w+)\b/m;

export function detect(name, text) {
  const n = name.toLowerCase();
  const ext = extname(n);
  if (n.endsWith('.drawio.png') || n.endsWith('.drawio.svg') || ext === '.drawio') return 'drawio';
  if (ext === '.excalidraw') return 'excalidraw';
  if (ext === '.mmd' || ext === '.mermaid') return 'mermaid';
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.dot' || ext === '.gv') return 'dot';
  if (['.puml', '.plantuml', '.pu', '.iuml', '.wsd'].includes(ext)) return 'plantuml';
  if (ext === '.d2') return 'd2';
  if (ext === '.dsl') return 'structurizr';
  if (ext === '.bpmn') return 'bpmn';
  if (ext === '.sql') return 'sql';
  if (ext === '.prisma') return 'prisma';
  if (ext === '.dbml') return 'dbml';
  if (ext === '.csv' || ext === '.tsv') return 'data';
  const t = text.trimStart();
  if (/<mxfile|<mxGraphModel/.test(t)) return 'drawio';
  if (/"type"\s*:\s*"excalidraw"/.test(t.slice(0, 400))) return 'excalidraw';
  if (/^(openapi|swagger)\s*:|"(openapi|swagger)"\s*:/m.test(t.slice(0, 2000))) return 'openapi';
  if (/<(\w+:)?definitions[\s\S]*bpmn/i.test(t.slice(0, 2000))) return 'bpmn';
  if (/^@start\w+/m.test(t)) return 'plantuml';
  if (/^\s*(strict\s+)?(di)?graph\b[^{]*\{/i.test(t)) return 'dot';
  if (/^\s*workspace\b/.test(t)) return 'structurizr';
  if (/create\s+table/i.test(t)) return 'sql';
  if (/^\s*model\s+\w+\s*\{/m.test(t) && /@id\b/.test(t)) return 'prisma';
  if (/^\s*Table\s+\w+/m.test(t)) return 'dbml';
  if (MERMAID_HEADS.test(t.replace(/^---[\s\S]*?---\s*/, '').split('\n').find((l) => l.trim() && !/^\s*%%/.test(l)) || '')) return 'mermaid';
  if (ext === '.json' || /^[[{]/.test(t)) return 'json';
  if (/(->|--)/.test(t) && /:/.test(t)) return 'd2';
  return null;
}

// ---- data files ------------------------------------------------------------
function inferData(rows, relPath, name) {
  if (!rows.length) return { error: 'no rows' };
  const cols = Object.keys(rows[0]);
  const num = cols.filter((c) => rows.every((r) => typeof r[c] === 'number' || r[c] === '' || r[c] == null));
  const str = cols.filter((c) => !num.includes(c));
  const lc = cols.map((c) => c.toLowerCase());
  const has = (...k) => k.map((x) => cols[lc.indexOf(x)]).find(Boolean);
  const from = has('from', 'source'), to = has('to', 'target'), val = has('value', 'amount', 'count', 'weight');
  const title = clean(name.replace(/[-_]+/g, ' '), 60);
  if (from && to && val) return { spec: { type: 'sankey', title, links: relPath, from, to, value: val }, why: 'from/to/value columns' };
  const timeLike = str[0] && rows.slice(0, 5).every((r) => /^\d{4}([-/]\d{1,2})?([-/]\d{1,2})?$|^(Q[1-4]|W\d+|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(String(r[str[0]])));
  if (str.length >= 1 && num.length === 1) return { spec: { type: 'bar', title, data: relPath, x: str[0], y: num[0], ...(rows.length > 8 ? { orientation: 'horizontal', sort: 'desc' } : {}) }, why: 'one label + one number column' };
  if (str.length >= 1 && num.length >= 2 && timeLike) return { spec: { type: 'line', title, data: relPath, xCol: str[0] }, why: 'time-like first column + several numeric series' };
  if (str.length >= 1 && num.length >= 2 && rows.length <= 20 && num.length >= 4) return { spec: { type: 'heatmap', title, data: relPath }, why: 'label column + many numeric columns' };
  if (str.length >= 1 && num.length >= 2) return { spec: { type: 'bar', title, data: relPath, x: str[0] }, why: 'label column + several numeric series (grouped bar)' };
  if (num.length >= 2) return { spec: { type: 'scatter', title, data: relPath, xCol: num[0], yCol: num[1], ...(num[2] ? { sizeCol: num[2], variant: 'bubble' } : {}) }, why: 'numeric columns → scatter' };
  return { error: 'could not infer a chart from these columns' };
}

function jsonTree(obj, depth = 0) {
  const entries = Object.entries(obj).slice(0, 8);
  return entries.map(([k, v]) => {
    const n = { label: clean(k, 36) };
    if (v && typeof v === 'object' && depth < 2) {
      const kids = Array.isArray(v) ? v.slice(0, 6).map((x, i) => (x && typeof x === 'object' ? [String(x.name || x.id || i), x] : [String(x), null])) : Object.entries(v);
      const children = kids.slice(0, 6).map(([kk, vv]) => (vv && typeof vv === 'object' && depth < 1 ? { label: clean(kk, 36), children: jsonTree(vv, depth + 2) } : { label: clean(kk, 36) }));
      if (children.length) n.children = children;
    } else if (v !== null && typeof v !== 'object') n.sub = clean(String(v), 40);
    return n;
  });
}

// ---- model → draft spec ----------------------------------------------------
function graphSpec(m) {
  const type = m.hint || 'architecture';
  const nodes = m.nodes.map(({ x, y, w, h, ...n }) => {
    const o = { ...n };
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    if (o.label === undefined && o.shape !== 'start' && o.shape !== 'end') o.label = o.id;
    if (o.label === '') o.label = '·';
    return o;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const known = (v) => ids.has(v) || ids.has(String(v).replace(/\.[^.]+$/, ''));
  const edges = m.edges.filter((e) => Array.isArray(e) || (known(e.from) && known(e.to))).map((e) => {
    if (Array.isArray(e)) return e;
    const kind = m.undirected ? 'line' : e.kind;
    if (e.both || e.change) return Object.fromEntries(Object.entries({ from: e.from, to: e.to, label: e.label, kind, both: e.both }).filter(([, v]) => v !== undefined && v !== ''));
    const t = [e.from, e.to];
    if (e.label || kind) t.push(e.label || '');
    if (kind) t.push(kind);
    return t;
  });
  const spec = { type, ...(m.title ? { title: m.title } : {}), ...(m.dir && type !== 'flowchart' ? { dir: m.dir } : m.dir === 'LR' ? { dir: 'LR' } : {}), nodes, edges };
  if (m.groups && m.groups.length) spec.groups = m.groups.map((g) => ({ id: g.id, label: g.label }));
  if (m.lanes && m.lanes.length) spec.lanes = m.lanes;
  const n = nodes.length;
  if (n > 9) spec.budget = n > 24 ? 'off' : 'faithful';
  return spec;
}

function toSpec(m) {
  switch (m.kind) {
    case 'graph': return graphSpec(m);
    case 'sequence': {
      const ok = (f) => f.from <= f.to && f.to < m.messages.length;
      return { type: 'sequence', ...(m.title ? { title: m.title } : {}), participants: m.participants, messages: m.messages.slice(0, 40), ...(m.fragments?.filter(ok).length ? { fragments: m.fragments.filter(ok).map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''))) } : {}), ...(m.notes?.length ? { notes: m.notes.filter((n) => n.over.length) } : {}), ...(m.numbered ? { numbered: true } : {}) };
    }
    case 'tree': return { type: 'tree', title: m.title, root: m.root };
    case 'gantt': return { type: 'gantt', ...(m.title ? { title: m.title } : {}), tasks: m.tasks, ...(m.milestones?.length ? { milestones: m.milestones } : {}) };
    case 'timeline': return { type: 'timeline', ...(m.title ? { title: m.title } : {}), events: m.events.map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined))) };
    case 'journey': return { type: 'journey', ...(m.title ? { title: m.title } : {}), stages: m.stages };
    case 'quadrant': return { type: 'quadrant', ...(m.title ? { title: m.title } : {}), x: m.x, y: m.y, quadrants: m.quadrants, items: m.items };
    case 'sankey': return { type: 'sankey', ...(m.title ? { title: m.title } : {}), links: m.links };
    case 'layers': return { type: 'layers', ...(m.title ? { title: m.title } : {}), layers: m.layers };
    case 'chart':
      if (m.hint === 'line') return { type: 'line', ...(m.title ? { title: m.title } : {}), x: m.x, series: m.series };
      return { type: 'bar', ...(m.title ? { title: m.title } : {}), ...(m.data ? { data: m.data } : { categories: m.categories, series: m.series }) };
    default: return null;
  }
}

// Parse one diagram (a unit from splitUnits) into a spec, or { error, fix }.
function parseUnit(u) {
  let model;
  try {
    switch (u.format) {
      case 'mermaid': model = parseMermaid(u.source); break;
      case 'dot': model = parseDot(u.source); break;
      case 'plantuml': model = parsePlantUml(u.source); break;
      case 'd2': model = parseD2(u.source); break;
      case 'drawio': model = parseDrawio(u.source); break;
      case 'excalidraw': model = parseExcalidraw(u.source); break;
      case 'structurizr': model = parseStructurizr(u.source); break;
      case 'bpmn': model = parseBpmn(u.source); break;
      case 'sql': model = parseSql(u.source); break;
      case 'prisma': model = parsePrisma(u.source); break;
      case 'dbml': model = parseDbml(u.source); break;
      case 'openapi': model = parseOpenApi(u.source); break;
      default: return { error: `no importer for ${u.format}` };
    }
  } catch (e) {
    return { error: `parse failed: ${String(e.message).split('\n')[0]}`, fix: 'read the file yourself and write a spec by hand (say no parser was used)' };
  }
  if (!model || model.error) return { error: model?.error || 'nothing parsed', fix: model?.fix || 'read the file yourself and write a spec by hand' };
  const notes = [];
  if (model.note) notes.push(model.note);
  if (model.dropped) notes.push(`${model.dropped} column(s) beyond 12 per table were dropped`);
  if (model.ops) notes.push(`${model.ops} operations grouped by tag`);
  const spec = toSpec(model);
  if (!spec) return { error: `cannot map ${model.kind}` };
  // the diagram's own title first, then the heading or page name around it
  if (!spec.title && u.title) spec.title = clean(u.title, 60);
  return { spec, notes };
}

export function importFile(path, flags = {}) {
  if (!existsSync(path)) return { ok: false, error: `not found: ${path}` };
  const buf = readFileSync(path);
  const name = basename(path);
  const text = /\.png$/i.test(name) ? '' : buf.toString('utf8');
  const format = flags.format || detect(name, text);
  if (!format) return { ok: false, error: 'unrecognized format', fix: 'read the file yourself and write a spec by hand (say no parser was used)' };
  const settings = configStatus(process.cwd()).settings;
  const stem = basename(name).replace(/(\.drawio)?\.[^.]+$/, '').replace(/[^\w-]+/g, '-');
  if (format === 'data' || format === 'json') {
    const out = flags.out ? resolve(flags.out) : resolve(settings.outputDir || 'diagrams', `${stem}.json`);
    return importData(path, format, text, stem, out, flags);
  }
  let units;
  try {
    units = splitUnits(format, format === 'drawio' ? extractDrawioXml(buf, name) : text);
  } catch (e) {
    return { ok: false, error: `parse failed: ${String(e.message).split('\n')[0]}`, fix: 'read the file yourself and write a spec by hand (say no parser was used)' };
  }
  if (!units.length) return { ok: false, error: 'no ```mermaid/dot/plantuml/d2 blocks in this markdown file' };
  if (flags.all) return importAll(units, { format, stem, settings, flags });

  const out = flags.out ? resolve(flags.out) : resolve(settings.outputDir || 'diagrams', `${stem}.json`);
  const i = Number(flags.block ?? flags.page ?? 0);
  const u = units[i];
  if (!u) return { ok: false, error: `no diagram #${i} (this file has ${units.length}: 0–${units.length - 1})` };
  const notes = [];
  if (units.length > 1) {
    const list = units.map((x, k) => `${k}:${x.title || x.lang || x.format}`).join(' | ');
    notes.push(`${units.length} diagrams in this file; imported #${i}. Use --block N for another, or --all for one spec per diagram in a folder: ${list}`);
  }
  const r = parseUnit(u);
  if (r.error) return { ok: false, error: r.error, ...(r.fix ? { fix: r.fix } : {}) };
  if (!r.spec.title) r.spec.title = clean(stem.replace(/[-_]+/g, ' '), 60);
  return finish(r.spec, out, u.format, [...notes, ...r.notes], flags);
}

// --all: every diagram in the file becomes <folder>/NN-<slug>.json, in
// source order, named after its title (diagram title, heading, page name).
function importAll(units, { format, stem, settings, flags }) {
  const folder = flags.out ? resolve(flags.out) : resolve(settings.outputDir || 'diagrams', stem);
  mkdirSync(folder, { recursive: true });
  const width = String(units.length).length < 2 ? 2 : String(units.length).length;
  const used = new Set();
  const diagrams = units.map((u, k) => {
    const index = k + 1;
    const r = parseUnit(u);
    if (r.error) return { index, ...(u.title ? { title: u.title } : {}), error: r.error };
    if (!r.spec.title) r.spec.title = clean(`${stem.replace(/[-_]+/g, ' ')} ${index}`, 60);
    let base = `${String(index).padStart(width, '0')}-${slugify(r.spec.title)}`;
    for (let n = 2; used.has(base); n++) base = `${base}-${n}`;
    used.add(base);
    const res = finish(r.spec, join(folder, `${base}.json`), u.format, r.notes, {});
    return { index, title: r.spec.title, type: res.type, draft: res.draft, ...(res.problems ? { problems: res.problems } : {}) };
  });
  const ok = diagrams.filter((d) => !d.error);
  return {
    ok: ok.length > 0,
    format,
    folder,
    count: diagrams.length,
    diagrams,
    ...(ok.length < diagrams.length ? { failed: diagrams.length - ok.length } : {}),
    next: `SC render ${folder} — renders every spec and writes index.html; then SC export ${folder} --for <destination>`,
  };
}

function importData(path, format, source, stem, out, flags) {
  const notes = [];
  let rows;
  try {
    if (format === 'json') {
      const j = JSON.parse(source);
      if (!Array.isArray(j) && !(j.data || j.rows)) {
        const spec = toSpec({ kind: 'tree', title: clean(stem, 60), root: { label: clean(stem, 36), children: jsonTree(j) } });
        return finish(spec, out, format, notes, flags);
      }
      rows = Array.isArray(j) ? j : j.data || j.rows;
    } else rows = readTable(path);
  } catch (e) {
    return { ok: false, error: `parse failed: ${String(e.message).split('\n')[0]}`, fix: 'read the file yourself and write a spec by hand (say no parser was used)' };
  }
  const rel = relative(dirname(out), path).split('\\').join('/');
  const r = inferData(rows, rel, stem);
  if (r.error) return { ok: false, error: r.error, fix: 'write a chart spec by hand; see references/types/bar.md' };
  notes.push(`data stays in ${rel} (${rows.length} rows); chart chosen because: ${r.why}`);
  return finish(r.spec, out, format, notes, flags);
}

function finish(specIn, out, format, notes, flags) {
  const spec = JSON.parse(JSON.stringify(specIn)); // drop undefined fields
  const n = spec.nodes?.length ?? spec.participants?.length ?? spec.tasks?.length ?? spec.events?.length ?? undefined;
  if (n > 24) notes.push(`${n} elements: pick a detail level — balanced (≤12) or simplified (≤7) — and merge before sharing`);
  else if (n > 12) notes.push(`${n} elements: consider "balanced" detail (≤12) by merging nodes that travel together`);
  if (spec.nodes && spec.nodes.some((x) => x.row === undefined)) notes.push('no source positions: nodes are auto-placed; patch row/col to refine layout');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${compactJson(spec)}\n`);
  // dry-run render to surface problems right away
  const r = renderSpec(spec, { specPath: out });
  const problems = (r.problems || r.result?.problems || []).filter((p) => !p.code.startsWith('I_')).slice(0, 4).map((p) => `${p.code} ${p.at || ''}: ${p.msg}`);
  const ids = spec.nodes ? Object.fromEntries(spec.nodes.slice(0, 40).map((x) => [x.id, x.label || x.shape])) : spec.participants ? Object.fromEntries(spec.participants.map((p) => [p.id, p.label])) : undefined;
  return {
    ok: true,
    format,
    type: spec.type,
    draft: out,
    ...(n !== undefined ? { count: n } : {}),
    ...(spec.edges ? { edges: spec.edges.length } : {}),
    ...(ids ? { ids } : {}),
    ...(notes.length ? { notes } : {}),
    ...(problems.length ? { problems } : {}),
    next: `SC render ${out}${spec.nodes ? ' — then improve layout with --patch row/col' : ''}`,
    ...(flags.print ? { spec } : {}),
  };
}
