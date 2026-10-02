// Install surfaces: versions agree, manifests point at the skill, the skill is
// self-contained (no node_modules), and the release zip is reproducible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSIONED, get } from '../tools/manifests.mjs';
import { buildZip } from '../tools/build-zip.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const json = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

test('every manifest carries the same version as package.json and SKILL.md', () => {
  const v = json('package.json').version;
  for (const [file, path] of VERSIONED) assert.equal(get(json(file), path), v, file);
  assert.match(readFileSync(join(ROOT, 'skills/seecode/SKILL.md'), 'utf8'), new RegExp(`version: "${v.replace(/\./g, '\\.')}"`));
});

test('plugin manifests are named seecode and point at the repo', () => {
  for (const f of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.factory-plugin/plugin.json']) {
    const j = json(f);
    assert.equal(j.name, 'seecode');
    assert.equal(j.repository, 'https://github.com/Aryanutkarsh/seecode');
  }
  assert.equal(json('.claude-plugin/marketplace.json').plugins[0].source, './');
  assert.equal(json('.codex-plugin/plugin.json').skills, './skills/');
});

test('the skill folder is self-contained: no npm imports outside node: builtins', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const f of walk(join(ROOT, 'skills/seecode/scripts')).filter((p) => p.endsWith('.mjs'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)) {
      assert.ok(m[1].startsWith('.') || m[1].startsWith('node:'), `${f} imports "${m[1]}"`);
    }
  }
  assert.ok(existsSync(join(ROOT, 'skills/seecode/scripts/vendor/LICENSES.md')));
});

test('dist zip is deterministic and has SKILL.md at seecode/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-zip-'));
  const a = buildZip(join(dir, 'a.zip'));
  const b = buildZip(join(dir, 'b.zip'));
  assert.ok(readFileSync(a.out).equals(readFileSync(b.out)), 'byte-identical');
  assert.ok(readFileSync(a.out).includes(Buffer.from('seecode/SKILL.md')));
});

test('maintainer policy matches the code it describes', () => {
  const policy = json('.maintainer-policy.json');
  assert.equal(policy.repository, 'Aryanutkarsh/seecode');
  assert.ok(json('package.json').repository.endsWith(policy.repository));
  // the policy's versioned manifests are exactly the ones the bump tool updates
  const listed = policy.versioning.manifests.map((m) => `${m.path}#${m.json_pointer}`).sort();
  const bumped = VERSIONED.map(([f, p]) => `${f}#/${p.join('/')}`).sort();
  assert.deepEqual(listed, bumped);
  // every npm script and repo file a gate names exists
  const scripts = json('package.json').scripts;
  for (const cmd of policy.gates.local_commands) {
    const npm = /^npm (?:run )?(\w+)/.exec(cmd);
    if (npm) assert.ok(npm[1] === 'test' ? scripts.test : scripts[npm[1]], `npm script for "${cmd}"`);
    const node = /^node (\S+)/.exec(cmd);
    if (node) assert.ok(existsSync(join(ROOT, node[1])), `file for "${cmd}"`);
  }
  // post-merge workflows exist under those names
  const names = readdirSync(join(ROOT, '.github/workflows')).map((f) => (/^name:\s*(.+)$/m.exec(readFileSync(join(ROOT, '.github/workflows', f), 'utf8')) || [])[1]?.trim());
  for (const w of policy.gates.post_merge_workflows) assert.ok(names.includes(w), `workflow "${w}"`);
});

test('license and policy documents are present and consistent', () => {
  for (const f of ['LICENSE', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'PRIVACY.md', 'THIRD_PARTY_LICENSES.md', 'CONTRIBUTING.md']) assert.ok(existsSync(join(ROOT, f)), f);
  // the skill ships its own copy of the license (installs copy only skills/seecode)
  assert.equal(readFileSync(join(ROOT, 'skills/seecode/LICENSE'), 'utf8'), readFileSync(join(ROOT, 'LICENSE'), 'utf8'));
  for (const f of ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.factory-plugin/plugin.json']) assert.equal(json(f).license, 'MIT', f);
  // every vendored library is credited in THIRD_PARTY_LICENSES.md at the bundled version
  const third = readFileSync(join(ROOT, 'THIRD_PARTY_LICENSES.md'), 'utf8');
  for (const [, name, version] of readFileSync(join(ROOT, 'skills/seecode/scripts/vendor/LICENSES.md'), 'utf8').matchAll(/^## (\S+) (\S+)/gm)) {
    assert.match(third, new RegExp(`\\| ${name} \\| ${version.replace(/\./g, '\\.')} \\|`), `${name} ${version}`);
  }
});
