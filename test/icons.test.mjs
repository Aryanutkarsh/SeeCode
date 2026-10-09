// Node icons: schema list matches the drawings; icons render, reserve room,
// stay decorative, and are skipped on shapes without room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICON_NAMES } from '../skills/seecode/scripts/lib/render/shared/icons.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';

const schema = (f) => JSON.parse(readFileSync(new URL(`../skills/seecode/schemas/${f}`, import.meta.url), 'utf8'));
const graph = (nodes) => ({ type: 'architecture', title: 'Icons', nodes, edges: [] });
const nodeW = (html, id) => Number(new RegExp(`data-sc-node="${id}"[\\s\\S]*?<rect class="n-box"[^>]*width="([\\d.]+)"`).exec(html)[1]);

test('every schema offers exactly the icons that exist', () => {
  assert.deepEqual(schema('graph.schema.json').$defs.node.properties.icon.enum, ICON_NAMES);
  assert.deepEqual(schema('sequence.schema.json').properties.participants.items.properties.icon.enum, ICON_NAMES);
  assert.deepEqual(schema('tree.schema.json').$defs.tnode.properties.icon.enum, ICON_NAMES);
});

test('an icon renders beside the label, hidden from screen readers, with room reserved', () => {
  const label = 'A fairly long label here';
  const withIcon = renderSpec(graph([{ id: 'a', label, icon: 'calendar' }]));
  const without = renderSpec(graph([{ id: 'a', label }]));
  assert.equal(withIcon.ok, true, JSON.stringify(withIcon.problems));
  assert.match(withIcon.html, /<g class="n-icon" transform="translate\([^)]+\) scale\([\d.]+\)" aria-hidden="true">/);
  assert.ok(nodeW(withIcon.html, 'a') > nodeW(without.html, 'a'), 'the box grows to fit the icon');
});

test('every icon draws without NaN', () => {
  const nodes = ICON_NAMES.map((icon, i) => ({ id: `n${i}`, label: icon, icon, row: Math.floor(i / 6), col: i % 6 }));
  const r = renderSpec({ ...graph(nodes), budget: 'off' });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal([...r.html.matchAll(/class="n-icon"/g)].length, ICON_NAMES.length);
  assert.doesNotMatch(r.html.slice(r.html.indexOf('<svg class="sc-svg'), r.html.indexOf('</svg>')), /NaN/);
});

test('unknown icons are rejected; decision shapes have no room and skip the icon', () => {
  assert.equal(renderSpec(graph([{ id: 'a', label: 'A', icon: 'unicorn' }])).ok, false);
  const r = renderSpec({ type: 'flowchart', title: 'F', nodes: [{ id: 'q', label: 'OK?', shape: 'decision', icon: 'check' }], edges: [] });
  assert.equal(r.ok, true);
  assert.doesNotMatch(r.html, /class="n-icon"/);
});

test('sequence participants take icons too', () => {
  const r = renderSpec({ type: 'sequence', title: 'S', participants: [{ id: 'me', label: 'Me', icon: 'person' }, { id: 'bank', label: 'Bank', icon: 'money' }], messages: [['me', 'bank', 'pay']] });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal([...r.html.matchAll(/class="n-icon"/g)].length, 2);
});
