// Chart scales never collapse; waterfall totals conserve exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceDomain, floorTo, ticks } from '../skills/seecode/scripts/lib/render/charts/scale.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';

test('niceDomain always has a span and clean bounds', () => {
  for (const d of [niceDomain(0, 0), niceDomain(Infinity, -Infinity)]) assert.ok(d.lo === 0 && d.hi > 0 && d.step > 0, JSON.stringify(d));
  const d = niceDomain(0, 0.3);
  assert.ok(d.hi >= 0.3 && d.hi > d.lo);
  assert.ok(ticks(d).every((t) => String(t).length < 6), ticks(d).join(','));
  assert.equal(niceDomain(-7, 12).lo <= -7, true);
});

test('a non-zero baseline never meets the top of the domain', () => {
  const d = niceDomain(50, 50);
  assert.ok(floorTo(d, 50) < d.hi);
});

const noNaN = (spec) => {
  const r = renderSpec(spec);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.doesNotMatch(r.html.slice(r.html.indexOf('<svg'), r.html.indexOf('</svg>')), /NaN|Infinity/);
  return r;
};

test('all-zero and all-equal data render without NaN', () => {
  noNaN({ type: 'bar', title: 'Zero', data: [['a', 0], ['b', 0]] });
  noNaN({ type: 'bar', title: 'Flat', zero: false, data: [['a', 50], ['b', 50]] });
  noNaN({ type: 'line', title: 'Zero', x: ['q1', 'q2'], series: [{ name: 's', values: [0, 0] }] });
  noNaN({ type: 'scatter', title: 'Zero', points: [{ label: 'a', x: 0, y: 0 }, { label: 'b', x: 0, y: 0 }] });
});

test('waterfall sums decimals exactly and flags a total that disagrees', () => {
  const r = noNaN({ type: 'waterfall', title: 'Exact', steps: [['Start', 0.1], ['Add', 0.2], { label: 'Net', total: true, value: 0.3 }] });
  assert.deepEqual((r.result.problems || []).filter((p) => p.code === 'W_TOTAL'), []);
  assert.match(r.html, /Net: 0\.3/);
  const bad = renderSpec({ type: 'waterfall', title: 'Off', steps: [['Start', 10], ['Add', 5], { label: 'Net', total: true, value: 16 }] });
  assert.ok(bad.result.problems.some((p) => p.code === 'W_TOTAL'));
});
