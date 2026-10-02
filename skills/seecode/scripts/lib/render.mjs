// Spec → HTML pipeline used by `seecode.mjs render|validate`.
import { setWidthScale } from './text.mjs';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';
import { TYPES, typeInfo, resolveAlias, ALIASES } from './types.mjs';
import { resolvePreset } from './motion.mjs';
import { buildPage } from './page.mjs';
import { loadData } from './data.mjs';

const SCHEMA_DIR = fileURLToPath(new URL('../../schemas/', import.meta.url));
const schemaCache = new Map();

function loadSchema(name) {
  if (!schemaCache.has(name)) {
    const common = JSON.parse(readFileSync(join(SCHEMA_DIR, 'common.schema.json'), 'utf8'));
    const body = JSON.parse(readFileSync(join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
    body.properties = { ...common.properties, ...body.properties };
    schemaCache.set(name, body);
  }
  return schemaCache.get(name);
}

// JSON merge patch (RFC 7396) with two token-saving extensions:
// - an array of {id,…} objects can be patched by an object keyed by id
//   ({"nodes":{"api":{"col":3},"old":null,"new1":{…}}});
// - tuple arrays (edges/messages/links) accept {"add":[…],"remove":["a>b"|index]}.
export function mergePatch(target, patch) {
  if (patch === null || typeof patch !== 'object') return patch;
  if (Array.isArray(patch)) return patch;
  if (Array.isArray(target)) return patchArray(target, patch);
  const out = target && typeof target === 'object' ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

function patchArray(arr, patch) {
  if ('add' in patch || 'remove' in patch) {
    const rm = new Set((patch.remove || []).map(String));
    const keyOf = (item, i) => {
      if (Array.isArray(item)) return `${item[0]}>${item[1]}`;
      if (item && typeof item === 'object') return item.id ?? `${item.from}>${item.to}`;
      return String(item);
    };
    return arr.filter((it, i) => !rm.has(String(i)) && !rm.has(keyOf(it, i))).concat(patch.add || []);
  }
  const out = arr.map((it) => ({ ...it }));
  for (const [id, v] of Object.entries(patch)) {
    const i = out.findIndex((it) => it && it.id === id);
    if (v === null) { if (i >= 0) out.splice(i, 1); }
    else if (i >= 0) out[i] = mergePatch(out[i], v);
    else out.push({ id, ...v });
  }
  return out;
}

// Stable, compact JSON: short arrays/objects stay on one line so a re-read
// costs few tokens.
export function compactJson(v, indent = '') {
  const one = JSON.stringify(v);
  if (one.length <= 100 || v === null || typeof v !== 'object') return one;
  const next = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => next + compactJson(x, next)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${compactJson(x, next)}`).join(',\n')}\n${indent}}`;
}

const FIX_HINTS = {
  'is required': 'add the field',
  'unknown field': 'remove it (see the type guide for allowed fields)',
};

export function renderSpec(input, { specPath, settings = {} } = {}) {
  const spec = resolveAlias(input);
  if (spec.variant === undefined) delete spec.variant;
  const info = typeInfo(spec.type);
  if (!info) {
    return { ok: false, problems: [{ code: 'E_TYPE', at: 'type', msg: `unknown type "${spec.type}"`, fix: `use one of: ${[...Object.keys(TYPES), ...Object.keys(ALIASES).filter((k) => TYPES[ALIASES[k][0]])].join(', ')}` }] };
  }
  const schemaProblems = validate(loadSchema(info.schema || spec.type), spec).map((p) => ({
    code: 'E_SPEC', at: p.at, msg: p.msg, fix: FIX_HINTS[p.msg] || (p.msg.startsWith('must be one of') ? 'pick an allowed value' : 'fix the value'),
  }));
  if (schemaProblems.length) return { ok: false, problems: dedupe(schemaProblems) };
  let resolved = spec;
  try {
    resolved = loadData(spec, specPath ? dirname(specPath) : process.cwd());
  } catch (e) {
    return { ok: false, problems: [{ code: 'E_DATA', at: 'data', msg: e.message, fix: 'check the data file path and format' }] };
  }
  const motion = spec.motion || settings.motion || 'auto';
  const preset = resolvePreset(motion === 'auto' && info.defaultMotion ? info.defaultMotion : motion, info.family);
  let result;
  const fonts = settings.brand && settings.brand.fonts;
  const prevScale = setWidthScale(fonts && (fonts.sans || fonts.mono) ? 1.1 : 1);
  try {
    result = info.renderer.render(resolved, { preset, settings });
  } catch (e) {
    return { ok: false, problems: [{ code: 'E_RENDER', at: '(root)', msg: e.message, fix: 'simplify the spec; if it persists this is a SeeCode bug' }], stack: e.stack };
  } finally {
    setWidthScale(prevScale);
  }
  if (!result.body) return { ok: false, problems: result.problems };
  const html = buildPage({ spec: resolved, result, preset: preset === 'none' ? null : preset, typeName: info.name, settings });
  return { ok: true, html, result, preset, info };
}

function dedupe(problems) {
  const seen = new Set();
  return problems.filter((p) => {
    const k = `${p.at}|${p.msg}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function outPathFor(spec, specPath, settings = {}) {
  if (spec.out) return resolve(specPath ? dirname(specPath) : process.cwd(), spec.out);
  if (specPath) return join(dirname(specPath), `${basename(specPath, extname(specPath)).replace(/\.spec$/, '')}.html`);
  return resolve(settings.outputDir || 'seecode-out', 'diagram.html');
}

export function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function summarize(r, out) {
  const all = r.problems || r.result?.problems || [];
  const errors = all.filter((p) => p.code.startsWith('E_'));
  const warns = all.filter((p) => p.code.startsWith('W_'));
  const infos = all.filter((p) => p.code.startsWith('I_'));
  const shown = [...errors, ...warns, ...infos].slice(0, 5).map((p) => {
    const o = { code: p.code };
    if (p.at) o.at = p.at;
    o.msg = p.msg;
    if (p.fix) o.fix = p.fix;
    return o;
  });
  const s = { ok: r.ok };
  if (out) s.out = out;
  if (r.ok) {
    s.type = r.info ? Object.keys(TYPES).find((k) => TYPES[k] === r.info) : undefined;
    if (r.result.graph) {
      s.nodes = r.result.graph.nodes.length;
      s.edges = r.result.graph.edges.length;
    }
    s.motion = r.preset;
    s.steps = r.result.steps;
  }
  if (shown.length) s.problems = shown;
  const hidden = errors.length + warns.length + infos.length - shown.length;
  if (hidden > 0) s.more = hidden;
  return s;
}

