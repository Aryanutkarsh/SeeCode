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
