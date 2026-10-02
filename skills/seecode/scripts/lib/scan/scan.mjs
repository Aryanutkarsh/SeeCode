// Compact repository digest for diagramming real code. Claude reads this
// (a few hundred tokens) instead of crawling the tree, then opens only the
// files it needs to confirm. Every claim carries file[:line] evidence.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname, basename, sep } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'target', 'vendor', '.next', '.nuxt', '__pycache__', '.venv', 'venv', 'coverage', '.turbo', '.cache', 'Pods', 'DerivedData']);
const CODE = { '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'js', '.ts': 'ts', '.tsx': 'ts', '.py': 'py', '.go': 'go', '.rs': 'rs', '.java': 'java', '.kt': 'kt', '.rb': 'rb', '.php': 'php', '.cs': 'cs', '.swift': 'swift', '.scala': 'scala', '.ex': 'ex', '.exs': 'ex' };
const MAX_FILES = 6000;
const MAX_READ = 200_000;

const TECH = [
  ['postgres', /\b(pg|postgres(ql)?|psycopg2?|asyncpg|pgx)\b|postgres(ql)?:\/\//i],
  ['mysql', /\bmysql2?\b|mysql:\/\//i],
  ['mongodb', /\bmongo(db|ose)?\b|mongodb(\+srv)?:\/\//i],
  ['redis', /\b(io)?redis\b|redis:\/\//i],
  ['kafka', /\bkafka(js)?\b|confluent/i],
  ['rabbitmq', /\bamqp(lib)?\b|rabbitmq/i],
  ['sqs/sns', /\b(SQS|SNS)Client\b|client-sqs|client-sns/],
  ['s3', /\bS3Client\b|client-s3|boto3.*s3|\bs3:\/\//],
  ['dynamodb', /dynamodb/i],
  ['elasticsearch', /elasticsearch|opensearch/i],
  ['graphql', /\bgraphql\b|apollo/i],
  ['grpc', /\bgrpc\b|\.proto\b/i],
  ['prisma', /@prisma\/client|\bprisma\b/],
  ['supabase', /supabase/i],
  ['firebase', /firebase/i],
  ['stripe', /\bstripe\b/i],
  ['openai', /\bopenai\b/i],
  ['anthropic', /anthropic|claude-/i],
  ['sentry', /@sentry|sentry_sdk/i],
  ['websocket', /\bws\b|socket\.io|websocket/i],
];

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < MAX_FILES) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (SKIP.has(e.name) || (e.name.startsWith('.') && !['.github', '.gitlab-ci.yml', '.env.example'].includes(e.name))) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) files.push(p);
    }
  }
  return files;
}

function read(p) {
  try {
    if (statSync(p).size > MAX_READ) return '';
    return readFileSync(p, 'utf8');
  } catch { return ''; }
}

function moduleOf(rel, depth) {
  const parts = rel.split(sep);
  parts.pop();
  if (!parts.length) return '.';
  const d = ['src', 'app', 'apps', 'packages', 'services', 'internal', 'cmd', 'lib', 'pkg'].includes(parts[0]) ? depth : depth - 1;
  return parts.slice(0, Math.max(1, d)).join('/');
}

function lineOf(text, idx) {
  return text.slice(0, idx).split('\n').length;
}

export function scanRepo(root, { depth = 2 } = {}) {
  if (!existsSync(root)) return { ok: false, error: `not found: ${root}` };
  const files = walk(root);
  const rels = files.map((f) => relative(root, f));
  const langs = {};
  const modules = new Map();
  const manifests = [];
  const infra = [];
  const entrypoints = [];
  const tech = new Map();
  const relSet = new Set(rels.map((r) => r.split(sep).join('/')));
  let goModule = null;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rel = rels[i].split(sep).join('/');
    const name = basename(f);
    const ext = extname(f).toLowerCase();
    if (name === 'package.json') {
      const j = (() => { try { return JSON.parse(read(f)); } catch { return null; } })();
      if (j) {
        const deps = Object.keys({ ...(j.dependencies || {}), ...(j.peerDependencies || {}) });
        manifests.push({ file: rel, kind: 'npm', name: j.name, deps: deps.slice(0, 20), ...(j.bin ? { bin: true } : {}), ...(j.workspaces ? { workspaces: true } : {}) });
        for (const d of deps) for (const [t, re] of TECH) if (re.test(d) && !tech.has(t)) tech.set(t, `${rel} (dep ${d})`);
        if (j.main) entrypoints.push(`${dirname(rel) === '.' ? '' : dirname(rel) + '/'}${j.main}`);
      }
    } else if (['pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml', 'build.gradle', 'composer.json', 'mix.exs', 'Package.swift'].includes(name)) {
      const t = read(f);
      const m = { file: rel, kind: name };
      if (name === 'go.mod') { goModule = (t.match(/^module\s+(\S+)/m) || [])[1]; m.name = goModule; }
      const depLines = t.split('\n').filter((l) => /^[\s\t]*[A-Za-z0-9_.@/-]+[\s=<>~^"]/.test(l) && !/^\s*(\[|#|\/\/|module|go |version|name|description)/.test(l)).slice(0, 40);
      m.deps = depLines.map((l) => l.trim().split(/[\s=<>~^"]/)[0]).filter(Boolean).slice(0, 20);
      manifests.push(m);
      for (const [tn, re] of TECH) if (re.test(t) && !tech.has(tn)) tech.set(tn, rel);
    } else if (/^(docker-compose|compose)\.ya?ml$/.test(name)) {
      const t = read(f);
      const svc = [];
      const block = t.split(/^services:\s*$/m)[1] || '';
      for (const m of block.matchAll(/^ {2}([A-Za-z0-9_.-]+):\s*$/gm)) svc.push(m[1]);
      infra.push({ file: rel, kind: 'compose', services: svc.slice(0, 20) });
    } else if (name === 'Dockerfile' || name.endsWith('.Dockerfile')) {
      const t = read(f);
      infra.push({ file: rel, kind: 'docker', from: (t.match(/^FROM\s+(\S+)/im) || [])[1], expose: (t.match(/^EXPOSE\s+(.+)$/im) || [])[1] });
    } else if (ext === '.tf') {
      const t = read(f);
      const res = [...t.matchAll(/^resource\s+"([^"]+)"/gm)].map((m) => m[1]);
      if (res.length) infra.push({ file: rel, kind: 'terraform', resources: [...new Set(res)].slice(0, 15) });
    } else if ((ext === '.yaml' || ext === '.yml') && /k8s|kube|helm|deploy|manifests/.test(rel)) {
      const t = read(f);
      const kinds = [...t.matchAll(/^kind:\s*(\w+)/gm)].map((m) => m[1]);
      if (kinds.length) infra.push({ file: rel, kind: 'k8s', objects: [...new Set(kinds)] });
    } else if (rel.startsWith('.github/workflows/')) {
      infra.push({ file: rel, kind: 'ci' });
    }

    const lang = CODE[ext];
    if (!lang) continue;
    langs[lang] = (langs[lang] || 0) + 1;
    const mod = moduleOf(rels[i], depth);
    if (!modules.has(mod)) modules.set(mod, { files: 0, imports: new Map(), langs: new Set() });
    const M = modules.get(mod);
    M.files++;
    M.langs.add(lang);
    if (/^(main|index|server|app|cli|manage|wsgi|asgi)\.(m?[jt]sx?|py|go|rs)$/.test(name) && rel.split('/').length <= 3) entrypoints.push(rel);
    if (/generated|\.min\./.test(name)) continue;
    const t = read(f);
    if (!t) continue;
    // tech evidence only from import/require lines or connection strings
    const lines = t.split('\n');
    for (let li = 0; li < lines.length && tech.size < TECH.length; li++) {
      const line = lines[li];
      if (!/^\s*(import|from|use|require|const .*require\(|extern crate)|\b(postgres(ql)?|rediss?|mongodb(\+srv)?|amqps?|mysql|s3):\/\/|new \w+Client\(/.test(line)) continue;
      for (const [tn, re] of TECH) if (!tech.has(tn) && re.test(line)) tech.set(tn, `${rel}:${li + 1}`);
    }
    const specs = [];
    if (lang === 'js' || lang === 'ts') {
      for (const m of t.matchAll(/(?:from\s+|require\(|import\()\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
      for (const s of specs) {
        if (!s.startsWith('.')) continue;
        const target = join(dirname(rels[i]), s);
        const tmod = moduleOf(join(target, 'x.js'), depth);
        const cand = [target, `${target}.ts`, `${target}.js`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.js`].map((c) => c.split(sep).join('/'));
        const hit = cand.find((c) => relSet.has(c));
        const resolvedMod = hit ? moduleOf(hit.split('/').join(sep), depth) : tmod;
        if (resolvedMod !== mod) M.imports.set(resolvedMod, (M.imports.get(resolvedMod) || 0) + 1);
      }
    } else if (lang === 'py') {
      for (const m of t.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
        const p = (m[1] || m[2]).split('.');
        for (let k = Math.min(p.length, depth); k >= 1; k--) {
          const cand = p.slice(0, k).join('/');
          if ([...modules.keys(), ...rels.map((r) => moduleOf(r, depth))].includes(cand) && cand !== mod) {
            M.imports.set(cand, (M.imports.get(cand) || 0) + 1);
            break;
          }
        }
      }
    } else if (lang === 'go' && goModule) {
      for (const m of t.matchAll(/"([^"]+)"/g)) {
        if (!m[1].startsWith(goModule + '/')) continue;
        const relp = m[1].slice(goModule.length + 1);
        const cand = moduleOf(join(relp, 'x.go'), depth);
        if (cand !== mod) M.imports.set(cand, (M.imports.get(cand) || 0) + 1);
      }
    }
  }

  const mods = [...modules.entries()]
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 24)
    .map(([dir, m]) => {
      const out = { dir, files: m.files };
      const imps = [...m.imports.entries()].filter(([d]) => modules.has(d)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, n]) => (n > 1 ? `${d}×${n}` : d));
      if (imps.length) out.uses = imps;
      return out;
    });
  return {
    ok: true,
    root,
    files: files.length,
    ...(files.length >= MAX_FILES ? { truncated: true } : {}),
    langs,
    manifests: manifests.slice(0, 12),
    entrypoints: [...new Set(entrypoints)].slice(0, 10),
    modules: mods,
    tech: Object.fromEntries(tech),
    infra: infra.slice(0, 15),
    next: 'Open only the files you need to confirm a node/edge; cite them in spec.evidence.',
  };
}
