// Custom legend labels: rename, hide, retitle; unknown keys warn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';

const base = {
  type: 'architecture', title: 'Leave plan',
  nodes: [
    { id: 'q', label: 'Quota', kind: 'external', row: 0, col: 0 },
    { id: 's', label: 'Spring', row: 0, col: 1 },
    { id: 'c', label: 'Calendar', kind: 'store', row: 0, col: 2 },
  ],
  edges: [['q', 's', '', 'primary'], ['s', 'c', '', 'async']],
};
const legendText = (html) => [...html.matchAll(/class="lg-(?:text|title)"[^>]*>([^<]*)/g)].map((m) => m[1]);
const meta = (html) => JSON.parse(/<script type="application\/json" id="sc-meta">([\s\S]*?)<\/script>/.exec(html)[1]);

test('legend entries rename and hide items, and the title can change', () => {
  const r = renderSpec({ ...base, legend: { title: '图例', entries: { backend: { label: '休假' }, external: { label: 'Allowance' }, store: { visible: false } } } });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const t = legendText(r.html);
  assert.equal(t[0], '图例');
  assert.ok(t.includes('休假') && t.includes('Allowance'), t.join('|'));
  assert.ok(!t.includes('Store') && !t.includes('Service'), t.join('|'));
  assert.deepEqual(meta(r.html).labels, { backend: '休假', external: 'Allowance' }, 'the viewer gets the same names');
  assert.deepEqual(r.result.problems.filter((p) => p.code === 'W_LEGEND_KEY'), []);
});

test('an entry for a key the diagram does not have warns with the valid keys', () => {
  const r = renderSpec({ ...base, legend: { entries: { security: { label: 'Rule' } } } });
  const w = r.result.problems.find((p) => p.code === 'W_LEGEND_KEY');
  assert.ok(w && /"security"/.test(w.msg) && /backend/.test(w.fix), JSON.stringify(w));
});

test('legend accepts true, false or an object; any other string is an error', () => {
  for (const legend of [true, false, { entries: {} }]) assert.equal(renderSpec({ ...base, legend }).ok, true, JSON.stringify(legend));
  assert.equal(renderSpec({ ...base, legend: 'custom' }).ok, false);
  assert.equal(renderSpec({ ...base, legend: { entries: { backend: { label: '' } } } }).ok, false, 'empty labels are rejected');
});

test('multi-series bar legends rename series too', () => {
  const r = renderSpec({ type: 'bar', title: 'Spend', categories: ['Jan', 'Feb'], series: [{ name: 'rent', values: [1, 2] }, { name: 'food', values: [2, 1] }], legend: { entries: { rent: { label: '房租' } } } });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.ok(legendText(r.html).includes('房租'), legendText(r.html).join('|'));
});
