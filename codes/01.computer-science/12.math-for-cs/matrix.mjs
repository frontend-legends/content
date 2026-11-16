// Проверки к 1.12 в Chromium: трансформации CSS — матрицы, порядок умножения важен; DOMMatrix совпадает
// с вычисленным transform; точка (10, 0) после translate+rotate и rotate+translate попадает в разные места.
// Запуск: cd codes && node run.mjs 01.computer-science/12.math-for-cs
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  await page.setContent('<div id="a" style="transform: translateX(100px) rotate(90deg)"></div><div id="b" style="transform: rotate(90deg) translateX(100px)"></div>');
  const r = await page.evaluate(() => {
    const round = (m) => [m.a, m.b, m.c, m.d, m.e, m.f].map((x) => Math.round(x));
    const pt = (m) => { const p = m.transformPoint(new DOMPoint(10, 0)); return [Math.round(p.x), Math.round(p.y)]; };
    const tr = new DOMMatrix().translate(100, 0).rotate(90);
    const rt = new DOMMatrix().rotate(90).translate(100, 0);
    const cssA = new DOMMatrix(getComputedStyle(document.getElementById('a')).transform);
    const cssB = new DOMMatrix(getComputedStyle(document.getElementById('b')).transform);
    return { tr: round(tr), rt: round(rt), cssA: round(cssA), cssB: round(cssB), ptTr: pt(tr), ptRt: pt(rt), product: round(new DOMMatrix().translate(100, 0).multiply(new DOMMatrix().rotate(90))) };
  });
  assert.deepEqual(r.tr, [0, 1, -1, 0, 100, 0]);                                             // сдвиг остался по x
  assert.deepEqual(r.rt, [0, 1, -1, 0, 0, 100]);                                             // сдвиг повернулся и ушёл в y
  assert.deepEqual(r.cssA, r.tr);
  assert.deepEqual(r.cssB, r.rt);
  assert.deepEqual(r.product, r.tr);                                                         // цепочка функций = произведение матриц
  assert.deepEqual([r.ptTr, r.ptRt], [[100, 10], [0, 110]]);

  // отдельные свойства: сначала translate, потом rotate, потом scale — порядок в CSS не важен
  await page.setContent(`<style>div { position: absolute; left: 0; top: 0; width: 40px; height: 10px; }</style>
    <div id="props" style="rotate: 90deg; translate: 100px 0"></div>
    <div id="tr" style="transform: translateX(100px) rotate(90deg)"></div>
    <div id="rt" style="transform: rotate(90deg) translateX(100px)"></div>`);
  const rects = await page.evaluate(() => Object.fromEntries(['props', 'tr', 'rt'].map((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return [id, [r.x, r.y, r.width, r.height].map(Math.round)];
  })));
  assert.deepEqual(rects.props, rects.tr);
  assert.notDeepEqual(rects.props, rects.rt);
});

console.log('matrix ok');
