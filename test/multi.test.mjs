// Files holding several diagrams: list them, import one or all into a
// folder of well-named specs, then render the folder (with index.html) and
// zip it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importFile } from '../skills/seecode/scripts/lib/importers/import.mjs';
import { renderFolder, zipFolder, diagramsIn } from '../skills/seecode/scripts/lib/folder.mjs';

const FIX = fileURLToPath(new URL('./fixtures/multi/', import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), 'sc-multi-'));
const all = (f) => importFile(join(FIX, f), { all: true, out: join(tmp(), f.replace(/\..*$/, '')) });
const names = (r) => r.diagrams.map((d) => d.draft.split(/[/\\]/).pop());

test('markdown: one spec per block, named after the heading above it', () => {
  const r = all('design-doc.md');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(names(r), ['01-request-flow.json', '02-payment-sequence.json', '03-order-lifecycle.json']);
  assert.deepEqual(r.diagrams.map((d) => d.type), ['flowchart', 'sequence', 'state']);
  assert.match(r.next, /SC render/);
});

test('draw.io pages, PlantUML sections, Mermaid diagrams and Excalidraw frames each split', () => {
  assert.deepEqual(names(all('two-pages.drawio')), ['01-overview.json', '02-data-storage.json']);
  assert.deepEqual(names(all('two-sections.puml')), ['01-login.json', '02-logout.json']);
  assert.deepEqual(names(all('two.mmd')), ['01-signup-flow.json', '02-billing-states.json']);
  const ex = all('frames.excalidraw');
  assert.deepEqual(names(ex), ['01-before.json', '02-after.json']);
  const after = JSON.parse(readFileSync(ex.diagrams[1].draft, 'utf8'));
  assert.deepEqual(after.nodes.map((n) => n.label), ['Orders service', 'Orders DB'], 'a frame keeps only its own shapes');
  assert.equal(after.edges.length, 1);
});

test('without --all one diagram is imported and the note lists the others', () => {
  const r = importFile(join(FIX, 'two-pages.drawio'), { out: join(tmp(), 'one.json') });
  assert.equal(r.ok, true);
  assert.match(r.notes[0], /2 diagrams in this file; imported #0.*--all.*0:Overview \| 1:Data & storage/);
  const second = importFile(join(FIX, 'two-pages.drawio'), { block: 1, out: join(tmp(), 'two.json') });
  assert.equal(JSON.parse(readFileSync(second.draft, 'utf8')).title, 'Data & storage');
  assert.equal(importFile(join(FIX, 'two-pages.drawio'), { block: 5 }).ok, false);
});

test('rendering a folder writes every diagram and an index in source order', () => {
  const r = all('design-doc.md');
  const f = renderFolder(r.folder);
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.equal(f.rendered, 3);
  assert.deepEqual(diagramsIn(r.folder).map((p) => p.split(/[/\\]/).pop()), ['01-request-flow.html', '02-payment-sequence.html', '03-order-lifecycle.html']);
  const index = readFileSync(f.index, 'utf8');
  const links = [...index.matchAll(/<a class="card" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['01-request-flow.html', '02-payment-sequence.html', '03-order-lifecycle.html']);
  assert.match(index, /Payment sequence/);
});

test('a folder without specs is a clear error', () => {
  const f = renderFolder(tmp());
  assert.equal(f.ok, false);
  assert.match(f.error, /no spec files/);
});

const hasUnzip = spawnSync('unzip', ['-v']).status === 0;
test('zipFolder packs the folder so it unzips intact', { skip: hasUnzip ? false : 'no unzip' }, () => {
  const r = all('two.mmd');
  renderFolder(r.folder);
  const zip = zipFolder(r.folder);
  const dest = tmp();
  const u = spawnSync('unzip', ['-q', zip, '-d', dest], { encoding: 'utf8' });
  assert.equal(u.status, 0, u.stderr);
  const got = readdirSync(join(dest, 'two')).sort();
  assert.deepEqual(got, readdirSync(r.folder).sort());
  assert.equal(readFileSync(join(dest, 'two', 'index.html'), 'utf8'), readFileSync(join(r.folder, 'index.html'), 'utf8'));
  assert.ok(existsSync(zip));
});
