// Label wrapping: spaces for Latin text, between characters for CJK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap, textWidth } from '../skills/seecode/scripts/lib/text.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';

const O = { size: 12 };

test('Latin text wraps at spaces only', () => {
  assert.deepEqual(wrap('Checkout API calls the payments service', 120, O), ['Checkout API calls', 'the payments service']);
  assert.deepEqual(wrap('Supercalifragilistic', 40, O), ['Supercalifragilistic'], 'a long word is never split');
});

test('CJK text wraps between characters and stays within the width', () => {
  for (const s of ['这是一个很长的中文节点标签用来测试自动换行功能是否正常', '注文サービスがデータベースに書き込みます']) {
    const lines = wrap(s, 120, O);
    assert.ok(lines.length > 1, s);
    assert.equal(lines.join(''), s, 'no characters lost or added');
    assert.ok(lines.every((l) => textWidth(l, O) <= 120), JSON.stringify(lines));
  }
});

test('CJK punctuation never starts a line; opening brackets never end one', () => {
  const lines = wrap('支付服务处理订单。然后发送邮件！（这是备注）结束', 108, O);
  assert.ok(lines.every((l) => !/^[。！，、）」]/.test(l) && !/[（「]$/.test(l)), JSON.stringify(lines));
});

test('a long Chinese node label wraps inside the 220px node cap', () => {
  const r = renderSpec({ type: 'architecture', title: '中文', nodes: [{ id: 'a', label: '这是一个很长的中文节点标签用来测试自动换行', row: 0, col: 0 }], edges: [] });
  const w = Number(/data-sc-node="a"[\s\S]*?<rect[^>]*width="([\d.]+)"/.exec(r.html)[1]);
  assert.ok(w <= 220, `node is ${w}px wide`);
});

test('lang sets the page language, right-to-left direction and the svg lang', () => {
  const spec = (lang, title) => ({ type: 'architecture', title, ...(lang ? { lang } : {}), nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }], edges: [['a', 'b']] });
  const zh = renderSpec(spec('zh-CN', '每月的钱去哪了'));
  assert.match(zh.html, /<html lang="zh-CN">/);
  assert.match(zh.html, /<svg class="sc-svg[^>]* lang="zh-CN"/);
  assert.match(zh.html, /data-sc-slug="每月的钱去哪了"/, 'non-Latin titles keep a meaningful slug');
  assert.match(renderSpec(spec('ar', 'كيف تعمل')).html, /<html lang="ar" dir="rtl">/);
  assert.match(renderSpec(spec(null, 'Checkout')).html, /<html lang="en">/);
  const bad = renderSpec(spec('english!', 'x'));
  assert.equal(bad.ok, false);
  assert.match(bad.problems[0].fix, /zh-CN/);
});

test('sans widths use measured IBM Plex advances, with a small margin', () => {
  // Plex Sans 400: W 891, M 812 per mille; the old estimate ran ~15% short on these
  const wide = textWidth('WWWMMM', { size: 100 });
  assert.ok(wide >= 3 * 89.1 + 3 * 81.2 && wide <= (3 * 89.1 + 3 * 81.2) * 1.05, String(wide));
  assert.ok(textWidth('Checkout API', { size: 12, weight: 600 }) > textWidth('Checkout API', { size: 12 }), 'bold is wider');
  assert.equal(textWidth('abc', { size: 12, mono: true }), 3 * 0.6 * 12, 'mono is unchanged');
});
