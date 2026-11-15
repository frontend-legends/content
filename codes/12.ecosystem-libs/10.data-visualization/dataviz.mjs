// Глава 12.10 — визуализация: шкалы и генераторы D3 (это математика, а не рисование), модульный D3 против полного,
// SVG против Canvas на 20 000 точек в Chromium: число узлов DOM, время отрисовки, попадание мышью.
// run: node dataviz.mjs
import assert from 'node:assert/strict';
import { scaleLinear, scaleBand, scaleTime } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';
import { extent, max } from 'd3-array';
import { withPage } from '../../_lib/browser.mjs';
import { cost } from '../../_lib/project.mjs';

// --- шкала: данные → пиксели
const sales = [{ day: '2026-11-10', sum: 120 }, { day: '2026-11-11', sum: 340 }, { day: '2026-11-12', sum: 210 }, { day: '2026-11-13', sum: 480 }];
const y = scaleLinear().domain([0, max(sales, (d) => d.sum)]).range([300, 0]).nice();
assert.deepEqual(y.domain(), [0, 500]);                    // nice() округлил границу до красивой
assert.equal(y(250), 150);
assert.equal(y.invert(150), 250);                          // и обратно: пиксели → данные
assert.deepEqual(y.ticks(5), [0, 100, 200, 300, 400, 500]);
const x = scaleBand().domain(sales.map((d) => d.day)).range([0, 400]).padding(0.2);
assert.equal(Math.round(x.bandwidth()), 76);
const t = scaleTime().domain(extent(sales, (d) => new Date(d.day))).range([0, 400]);
assert.equal(Math.round(t(new Date('2026-11-11'))), 133);

// --- генератор пути: строка для атрибута d, без DOM
const path = line().x((d) => t(new Date(d.day))).y((d) => y(d.sum)).curve(curveMonotoneX)(sales);
assert.match(path, /^M0,228C/);                            // начало пути и кривая

// --- размер: модули D3 против всего пакета
const kb = async (c) => +((await cost(c)).gzip / 1024).toFixed(1);
const sizes = {
  'd3-scale + d3-shape': await kb("import { scaleLinear } from 'd3-scale'; import { line } from 'd3-shape'; console.log(line().x(scaleLinear()));"),
  'import * as d3 from "d3"': await kb("import * as d3 from 'd3'; console.log(d3);"),
};
console.table(sizes);
assert.ok(sizes['import * as d3 from "d3"'] > sizes['d3-scale + d3-shape'] * 3);

// --- SVG против Canvas на 20 000 точек
await withPage(async (page) => {
  await page.setContent('<div id="svg-host"></div><canvas id="c" width="800" height="400"></canvas>');
  const r = await page.evaluate(() => {
    const N = 20000;
    const pts = Array.from({ length: N }, (_, i) => [(i * 37) % 800, (i * 91) % 400]);
    let t0 = performance.now();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', 800); svg.setAttribute('height', 400);
    for (const [x, y] of pts) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 2); svg.append(c); }
    document.querySelector('#svg-host').append(svg);
    svg.getBoundingClientRect();                           // заставить раскладку
    const svgMs = performance.now() - t0;
    t0 = performance.now();
    const ctx = document.querySelector('#c').getContext('2d');
    for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    const canvasMs = performance.now() - t0;
    // попадание мышью: у SVG — элемент под курсором, у Canvas — только пиксели
    const [hx, hy] = pts[5];
    const rect = svg.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + hx, rect.top + hy);
    const crect = document.querySelector('#c').getBoundingClientRect();
    const canvasHit = document.elementFromPoint(crect.left + hx, crect.top + hy);
    return { svgNodes: svg.querySelectorAll('circle').length, svgMs, canvasMs, svgHit: hit.tagName, canvasHit: canvasHit.tagName };
  });
  console.log(`20 000 точек: SVG ${r.svgMs.toFixed(0)} мс, Canvas ${r.canvasMs.toFixed(0)} мс`);
  assert.equal(r.svgNodes, 20000);                         // 20 000 узлов DOM
  assert.ok(r.svgMs > r.canvasMs * 2);
  assert.equal(r.svgHit, 'circle');                        // SVG: события на конкретной точке
  assert.equal(r.canvasHit, 'CANVAS');                     // Canvas: только холст, точку нужно искать самому
});
console.log('dataviz ok');
