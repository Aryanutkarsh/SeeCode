// What users actually install: SKILL.md frontmatter that every host's YAML
// parser accepts, a release zip that carries the same skill as the source,
// and (opt-in, needs network) a real `npx skills add` that renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip } from '../tools/build-zip.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILL = join(ROOT, 'skills/seecode');
const source = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');

// Minimal reader for the frontmatter shapes we use (top-level scalars and one
// nested map). Plain scalars are held to YAML's rules: ": " or " #" inside an
// unquoted value breaks strict parsers, which then drop the whole skill.
function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(m, 'SKILL.md starts with delimited YAML frontmatter');
  const out = {};
  let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\s*)([\w-]+):(?:\s+(.*))?$/.exec(line);
    assert.ok(kv, `frontmatter line is key: value -> ${line}`);
    const [, indent, key, raw = ''] = kv;
    let value = raw;
    if (/^"/.test(raw)) {
      assert.match(raw, /^"(?:[^"\\]|\\.)*"$/, `${key}: double-quoted value is closed`);
      value = JSON.parse(raw);
    } else if (/^'/.test(raw)) {
      assert.match(raw, /^'(?:[^']|'')*'$/, `${key}: single-quoted value is closed`);
      value = raw.slice(1, -1).replace(/''/g, "'");
    } else {
      assert.doesNotMatch(raw, /: | #|^[&*!|>%@`]/, `${key}: plain value needs quotes`);
    }
    if (indent) { assert.ok(parent, `${key} is nested under a map`); out[parent][key] = value; }
    else if (raw === '') { parent = key; out[key] = {}; }
    else { parent = null; out[key] = value; }
  }
  return out;
}

test('SKILL.md frontmatter is valid YAML that installers accept', () => {
  const fm = frontmatter(source);
  assert.equal(fm.name, 'seecode');
  assert.ok(fm.description && fm.description.length <= 1024, `description ${fm.description?.length} chars (limit 1024)`);
  assert.equal(fm.metadata.version, JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
  // CRLF checkouts (Windows) parse the same
  assert.deepEqual(frontmatter(source.replace(/\r?\n/g, '\r\n')), fm);
});

test('the frontmatter check rejects an unquoted ": " (the bug it guards)', () => {
  assert.throws(() => frontmatter('---\nname: x\ndescription: use for plans: trips\n---\n'), /needs quotes/);
});

const walk = (dir) => readdirSync(dir).sort().flatMap((f) => {
  if (f === '.DS_Store' || f.startsWith('.tmp')) return [];
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const hasUnzip = spawnSync('unzip', ['-v']).status === 0;

test('release zip carries exactly the source skill', { skip: hasUnzip ? false : 'no unzip' }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-install-zip-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { out } = buildZip(join(dir, 'seecode.zip'));
  const r = spawnSync('unzip', ['-q', out, '-d', join(dir, 'x')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const got = join(dir, 'x/seecode');
  assert.equal(readFileSync(join(got, 'SKILL.md'), 'utf8'), source);
  const rel = (base) => walk(base).map((p) => relative(base, p));
  assert.deepEqual(rel(got), rel(SKILL));
});

// Opt-in: downloads the `skills` installer (needs network and Node >= 22.20).
// CI runs it in its own job; locally: SEECODE_INSTALL_TEST=1 npm test
const SKILLS_CLI = 'skills@1.7.1';
test('a real `npx skills add` installs a skill that renders', { skip: process.env.SEECODE_INSTALL_TEST ? false : 'set SEECODE_INSTALL_TEST=1', timeout: 300000 }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-install-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const proj = join(dir, 'proj');
  mkdirSync(join(dir, 'home'), { recursive: true });
  mkdirSync(proj);
  spawnSync('git', ['init', '-q'], { cwd: proj });
  const env = { ...process.env, HOME: join(dir, 'home'), USERPROFILE: join(dir, 'home'), DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1' };
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const listed = spawnSync(npx, ['-y', SKILLS_CLI, 'add', ROOT, '-l'], { cwd: proj, env, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /Found 1 skill/, 'only seecode is exposed to installers');
  const add = spawnSync(npx, ['-y', SKILLS_CLI, 'add', ROOT, '-a', 'claude-code', '-s', 'seecode', '-y', '--copy'], { cwd: proj, env, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr || add.stdout);
  const installed = join(proj, '.claude/skills/seecode');
  assert.equal(readFileSync(join(installed, 'SKILL.md'), 'utf8'), source);
  const spec = join(dir, 'x.json');
  writeFileSync(spec, JSON.stringify({ type: 'flowchart', title: 'Installed', nodes: [{ id: 'a', label: 'Start' }, { id: 'b', label: 'Done' }], edges: [['a', 'b']] }));
  const r = spawnSync(process.execPath, [join(installed, 'scripts/seecode.mjs'), 'render', spec], { cwd: proj, env, encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).ok, true, r.stdout + r.stderr);
});

test('doctor reports the installed skill version', { timeout: 60000 }, () => {
  const r = spawnSync(process.execPath, [join(SKILL, 'scripts/seecode.mjs'), 'doctor'], { encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).version, frontmatter(source).metadata.version);
});
