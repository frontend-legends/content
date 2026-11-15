// Проверки к 17.08: «сначала измерь» — профайлер находит узкое место не там, где кажется; три рычага
// (меньше работы, кеш, позже) на настоящем замере; пороги RAIL как арифметика; бюджет производительности
// на реальном размере бандла после минификации и gzip.
import assert from 'node:assert/strict';
import { cost } from '../../_lib/project.mjs';

const bench = (fn, runs = 1) => { const t = performance.now(); for (let i = 0; i < runs; i++) fn(); return performance.now() - t; };

// --- сначала измерь: подозрительный код против настоящего узкого места ---
// Функция с виду тяжёлая — много строк и ветвлений, но вызывается один раз на отрисовку.
function buildHeader(order) {
  let title = order.id ? `Заказ №${order.id}` : 'Черновик';
  if (order.paid) title += ', оплачен';
  if (order.express) title += ', экспресс';
  if (order.gift) title += ', подарок';
  const parts = [];
  for (const tag of order.tags ?? []) parts.push(tag.toUpperCase());
  return title + (parts.length ? ` [${parts.join(', ')}]` : '');
}
// Функция с виду безобидная — одна строка, но создаёт форматтер на каждый из тысяч товаров.
const items = Array.from({ length: 5000 }, (_, i) => ({ price: 1000 + i * 7.5 }));
const formatPerCall = (p) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(p);

const headerCost = bench(() => buildHeader({ id: 42, paid: true, express: true, tags: ['sale', 'new'] }), 5000);
const listCost = bench(() => { for (const it of items) formatPerCall(it.price); });
// То, что «выглядит сложным», дешевле того, что выглядит простым: оптимизировать надо замеренное.
assert.ok(listCost > headerCost * 10, `список ${listCost.toFixed(1)} мс против шапки ${headerCost.toFixed(1)} мс`);

// --- рычаг «меньше работы»: один форматтер вместо тысяч ---
const nf = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });
const reuse = bench(() => { for (const it of items) nf.format(it.price); });
assert.ok(listCost > reuse * 5, `переиспользование ускорило с ${listCost.toFixed(1)} до ${reuse.toFixed(2)} мс`);
assert.equal(nf.format(1007.5), formatPerCall(1007.5)); // результат тот же, цена другая

// --- рычаг «кеш»: не считать повторно то, что повторяется ---
const bins = Array.from({ length: 5000 }, () => [0, 990, 1990, 4900][Math.floor((Math.sin(1) + 1) * 2) % 4]); // всего несколько разных цен
const prices = bins.map((_, i) => [990, 1990, 4900, 990, 1990][i % 5]);
const cache = new Map();
const memo = (p) => { let v = cache.get(p); if (v === undefined) { v = nf.format(p); cache.set(p, v); } return v; };
const cachedCost = bench(() => { for (const p of prices) memo(p); });
assert.equal(cache.size, 3);                 // три уникальные цены, остальное — попадания в кеш
assert.equal(memo(990), nf.format(990));
assert.ok(cachedCost <= reuse, `кеш не медленнее переформатирования: ${cachedCost.toFixed(2)} vs ${reuse.toFixed(2)}`);

// --- пороги RAIL (ориентиры Google; для новых целей их заменили Core Web Vitals) ---
const rail = { responseMs: 100, processInputMs: 50, frameMs: 16, idleChunkMs: 50, firstLoadS: 5, repeatLoadS: 2 };
assert.equal(Math.floor(1000 / 60), rail.frameMs);                  // 60 кадров в секунду → ~16 мс на кадр
assert.ok(rail.processInputMs < rail.responseMs);                   // обработчик укладывается в реакцию с запасом
const overBudget = (taskMs) => taskMs > rail.idleChunkMs;          // фоновую работу дробят на куски по 50 мс
assert.equal(overBudget(120), true);
assert.equal(overBudget(40), false);

// --- бюджет производительности: сборка падает, если точка входа больше лимита ---
const BUDGET_GZIP = 20 * 1024;
const check = async (entry) => { const { gzip } = await cost(entry); return { gzip, ok: gzip <= BUDGET_GZIP }; };
const light = await check("export const sum = (a, b) => a + b; console.log(sum(2, 3));");
const heavy = await check("import { format } from 'date-fns'; import _ from 'lodash'; console.log(format(Date.now(), 'yyyy'), _.chunk([1, 2, 3], 2));");
assert.equal(light.ok, true);
assert.ok(light.gzip < 1024, `крошечная точка входа ${light.gzip} Б`);
assert.equal(heavy.ok, false);                                     // тяжёлые зависимости не влезли в бюджет
assert.ok(heavy.gzip > BUDGET_GZIP, `${heavy.gzip} Б > ${BUDGET_GZIP} Б`);

console.log('fundamentals ok');
