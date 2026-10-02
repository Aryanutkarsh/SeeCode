import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePatch, compactJson } from '../skills/seecode/scripts/lib/render.mjs';

const spec = { type: 'architecture', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b', 'x']] };

test('object merge and null delete', () => {
  assert.deepEqual(mergePatch({ a: 1, b: { c: 2 } }, { b: { d: 3 }, a: null }), { b: { c: 2, d: 3 } });
});

test('id-keyed array patch updates, removes and adds', () => {
  const out = mergePatch(spec, { nodes: { a: { col: 2 }, b: null, c: { label: 'C', row: 1, col: 0 } } });
  assert.deepEqual(out.nodes, [{ id: 'a', label: 'A', row: 0, col: 2 }, { id: 'c', label: 'C', row: 1, col: 0 }]);
  assert.equal(spec.nodes[0].col, 0, 'original untouched');
});

test('tuple arrays support add/remove by from>to and index', () => {
  assert.deepEqual(mergePatch(spec, { edges: { remove: ['a>b'], add: [['b', 'a']] } }).edges, [['b', 'a']]);
  assert.deepEqual(mergePatch(spec, { edges: { remove: [0] } }).edges, []);
});

test('compactJson keeps short items on one line and round-trips', () => {
  const s = compactJson(spec);
  assert.deepEqual(JSON.parse(s), spec);
  assert.ok(s.includes('{"id":"a","label":"A","row":0,"col":0}'));
});
