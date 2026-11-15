// Проверки к 17.14: агрегация полевых данных (p75 по метрике и оценка по порогам CWV), почему лаборатория
// и поле расходятся (один быстрый замер «хорошо», хвост реальных устройств — «плохо»), алерт на регрессию
// между релизами и CI-гейт бюджета производительности на настоящем размере бандла.
import assert from 'node:assert/strict';
import { cost } from '../../_lib/project.mjs';

// пороги Core Web Vitals
const THRESHOLDS = { LCP: 2500, INP: 200, CLS: 0.1 };
const rate = (metric, value) => value <= THRESHOLDS[metric] ? 'good' : 'poor';
const p75 = (values) => { const s = [...values].sort((a, b) => a - b); return s[Math.ceil(s.length * 0.75) - 1]; };

// --- агрегация RUM: оценка по 75-му перцентилю, а не по среднему ---
// поле: большинство на быстрых устройствах (1800 мс), заметный хвост на слабых (5200 мс)
const field = [...Array(72).fill(1800), ...Array(14).fill(3200), ...Array(14).fill(5200)];
const mean = Math.round(field.reduce((a, b) => a + b, 0) / field.length);
assert.equal(mean, 2472);                       // среднее чуть ниже порога — выглядит «хорошо»
assert.equal(rate('LCP', mean), 'good');
assert.equal(p75(field), 3200);                 // но каждому четвёртому — хуже 3200 мс
assert.equal(rate('LCP', p75(field)), 'poor');  // по полю метрика «плохая»

// --- лаборатория против поля: один замер на быстрой машине обманывает ---
const labRun = 1700;                            // Lighthouse на мощном ноутбуке
assert.equal(rate('LCP', labRun), 'good');      // лаборатория зелёная…
assert.notEqual(rate('LCP', p75(field)), rate('LCP', labRun)); // …а поле — нет: оптимизируй по лаборатории, подтверждай по полю

// --- алерт на регрессию между релизами ---
// сравнивают p75 полевых метрик до и после релиза; шум игнорируют, заметный рост — тревога
const regression = (before, after, tol = 0.1) => {
  const alerts = [];
  for (const m of Object.keys(after)) {
    const a = p75(before[m]), b = p75(after[m]);
    if (b > a * (1 + tol)) alerts.push({ metric: m, from: a, to: b });
  }
  return alerts;
};
const before = { LCP: [...Array(75).fill(1800), ...Array(25).fill(2300)], INP: [...Array(75).fill(120), ...Array(25).fill(180)] };
// релиз утяжелил главный поток: INP вырос, LCP почти не изменился (шум)
const after = { LCP: [...Array(75).fill(1820), ...Array(25).fill(2320)], INP: [...Array(75).fill(210), ...Array(25).fill(360)] };
const alerts = regression(before, after);
assert.equal(alerts.length, 1);
assert.deepEqual(alerts[0], { metric: 'INP', from: 120, to: 210 }); // тревога только по INP
assert.equal(rate('INP', alerts[0].to), 'poor');                    // и это уже за порогом

// --- CI-гейт бюджета: лабораторные метрики и реальный размер бандла против лимитов ---
const bundleKb = Math.round((await cost("import { format } from 'date-fns'; import _ from 'lodash'; export default [format, _];")).gzip / 1024);
assert.ok(bundleKb > 20, `бандл ${bundleKb} КБ`);   // тяжёлые зависимости — реально измеренный вес

const BUDGET = { LCP: 2500, INP: 200, CLS: 0.1, bundleKb: 20 };
const gate = (measured) => {
  const over = Object.entries(measured).filter(([k, v]) => v > BUDGET[k]).map(([k]) => k);
  return { pass: over.length === 0, over };
};
const good = gate({ LCP: 2100, INP: 150, CLS: 0.05, bundleKb: 18 });
assert.deepEqual(good, { pass: true, over: [] });
const bad = gate({ LCP: 2100, INP: 150, CLS: 0.05, bundleKb });     // тот же PR, но бандл превысил бюджет
assert.equal(bad.pass, false);
assert.deepEqual(bad.over, ['bundleKb']);                           // сборка падает и называет, что именно выросло

// --- рабочий цикл как последовательность шагов ---
const loop = ['измерить', 'поставить бюджет', 'оптимизировать узкое место', 'подтвердить измерением', 'следить в проде'];
assert.equal(loop[0], 'измерить');                 // начинается с измерения, а не с догадки
assert.equal(loop.at(-1), 'следить в проде');      // и не заканчивается релизом

console.log('monitoring ok');
