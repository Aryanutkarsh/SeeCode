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

test('tiny and huge magnitudes keep a span and distinct labels', async () => {
  const { fmt } = await import('../skills/seecode/scripts/lib/render/charts/scale.mjs');
  for (const max of [3e-14, 0.004, 0.3, 1234567, 2e15]) {
    const d = niceDomain(0, max);
    assert.ok(d.hi >= max && d.hi > d.lo, `${max}: ${JSON.stringify(d)}`);
    const labels = ticks(d).map((t) => fmt(t));
    assert.equal(new Set(labels).size, labels.length, `${max}: ${labels}`);
  }
  assert.deepEqual([fmt(0.002), fmt(0.004), fmt(1e15), fmt(2.5e12), fmt(1234.567), fmt(0.1 + 0.2)], ['0.002', '0.004', '1000T', '2.5T', '1234.57', '0.3']);
});

test('charts of tiny values render real coordinates and labels', () => {
  const bar = noNaN({ type: 'bar', title: 'Small', data: [['a', 0.002], ['b', 0.004]] });
  assert.match(bar.html, />0\.004</);
  noNaN({ type: 'scatter', title: 'Tiny', points: [{ label: 'a', x: 1e-14, y: 2e-14 }, { label: 'b', x: 3e-14, y: 1e-14 }] });
  noNaN({ type: 'line', title: 'Tiny', x: ['q1', 'q2'], series: [{ name: 's', values: [1e-14, 3e-14] }] });
});

test('heatmap values reach 4.5:1 on every cell, in both themes and with a brand', async () => {
  const { mix, contrast } = await import('../skills/seecode/scripts/lib/color.mjs');
  const { themePalettes, ON_FILL_TEXT, skinCss } = await import('../skills/seecode/scripts/lib/tokens.mjs');
  const values = [Array.from({ length: 8 }, (_, i) => i), Array.from({ length: 8 }, (_, i) => i * 10 + 3)];
  for (const brand of [{}, { accent: '#D4A574' }, { accent: '#3b82f6' }]) {
    const r = renderSpec({ type: 'heatmap', title: 'H', rows: ['a', 'b'], cols: 'abcdefgh'.split(''), values }, { settings: { brand } });
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    const pal = themePalettes({ brand });
    const cells = [...r.html.matchAll(/<rect class="hm-cell hm-pos"[^>]*fill-opacity="([\d.]+)"[\s\S]*?<text class="hm-val (v[01][01])"/g)];
    assert.equal(cells.length, 16);
    for (const [, a, cls] of cells) {
      for (const [slot, p] of [[1, pal.light], [2, pal.dark]]) {
        const bg = mix(p.paper, p.accent, Number(a));
        const c = contrast(ON_FILL_TEXT[cls[slot]], bg);
        assert.ok(c >= 4.5, `${JSON.stringify(brand)} theme ${slot}: alpha ${a} gives ${c.toFixed(2)}:1`);
      }
    }
    assert.match(skinCss({ brand }), /--sc-on-v10:#ffffff/);
  }
});

test('a heatmap too narrow for in-cell values says so', () => {
  const cols = Array.from({ length: 24 }, (_, i) => `c${i}`);
  const r = renderSpec({ type: 'heatmap', title: 'Wide', rows: ['a'], cols, values: [cols.map((_, i) => i)] });
  assert.ok(r.result.problems.some((p) => p.code === 'W_HEATMAP_LABELS'));
});
