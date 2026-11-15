// Проверки к 16.01: связанность и циклы — настоящим dependency-cruiser на двух версиях модулей корзины;
// инверсия зависимостей — тест без моков сети; «неправильная абстракция» — рост числа флагов.
import assert from 'node:assert/strict';
import { project, run, bin, vitest } from '../../_lib/project.mjs';

const cruise = (files) => {
  const dir = project({ 'package.json': JSON.stringify({ type: 'module' }), ...files }, { linkModules: false });
  const r = run(bin('depcruise'), ['src', '--output-type', 'json', '--no-config'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  const report = JSON.parse(r.stdout);
  const deps = Object.fromEntries(report.modules.map((m) => [m.source.replace('src/', ''), m.dependencies.map((d) => d.resolved.replace('src/', ''))]));
  const cycles = report.modules.flatMap((m) => m.dependencies.filter((d) => d.circular).map((d) => `${m.source.replace('src/', '')} → ${d.resolved.replace('src/', '')}`));
  const fanIn = (file) => Object.values(deps).filter((list) => list.includes(file)).length;
  return { deps, cycles, fanIn };
};

// --- до: всё знает про всё ---
const tangled = cruise({
  'src/cart.js': "import { discountFor } from './pricing.js';\nimport { render } from './ui.js';\nexport const items = [];\nexport const add = (p) => { items.push(p); render(); };\nexport const total = () => items.reduce((s, p) => s + p.price - discountFor(p), 0);\n",
  'src/pricing.js': "import { items } from './cart.js';\nexport const discountFor = (p) => (items.length >= 10 ? p.price * 0.1 : 0);\n",
  'src/ui.js': "import { total } from './cart.js';\nimport { discountFor } from './pricing.js';\nexport const render = () => console.log(total());\n",
});
assert.ok(tangled.cycles.length >= 2, tangled.cycles.join(', ')); // корзина ↔ цены, корзина ↔ интерфейс
assert.ok(tangled.cycles.includes('cart.js → pricing.js'));
assert.ok(tangled.cycles.includes('cart.js → ui.js'));

// --- после: правило цены — чистая функция, корзина ничего не знает об интерфейсе ---
const clean = cruise({
  'src/pricing.js': "export const discountFor = (p, count) => (count >= 10 ? p.price * 0.1 : 0);\n",
  'src/cart.js': "import { discountFor } from './pricing.js';\nexport function createCart(onChange) {\n  const items = [];\n  return { add: (p) => { items.push(p); onChange(); }, total: () => items.reduce((s, p) => s + p.price - discountFor(p, items.length), 0) };\n}\n",
  'src/ui.js': "import { createCart } from './cart.js';\nconst cart = createCart(() => console.log(cart.total()));\nexport default cart;\n",
});
assert.deepEqual(clean.cycles, []);
assert.deepEqual(clean.deps['pricing.js'], []);   // правило ни от чего не зависит
assert.deepEqual(clean.deps['cart.js'], ['pricing.js']);
assert.equal(clean.fanIn('ui.js'), 0);            // интерфейс никто не импортирует — зависимости направлены внутрь

// --- инверсия зависимостей: компонент получает поиск параметром и тестируется без сети ---
const t = vitest({
  'search.js': `export function createSearch({ fetchProducts, debounce = 0 }) {
  return async (query) => (query.trim().length < 2 ? [] : fetchProducts(query.trim()));
}`,
  'search.test.js': `import { test, expect, vi } from 'vitest';
import { createSearch } from './search.js';
test('короткий запрос не уходит в сеть', async () => {
  const fetchProducts = vi.fn();
  expect(await createSearch({ fetchProducts })('п')).toEqual([]);
  expect(fetchProducts).not.toHaveBeenCalled();
});
test('запрос передаётся без пробелов', async () => {
  const fetchProducts = vi.fn(async (q) => [{ title: q }]);
  expect(await createSearch({ fetchProducts })('  пуэр ')).toEqual([{ title: 'пуэр' }]);
});`,
});
assert.equal(t.numPassedTests, 2, t.out);

// --- неправильная абстракция: «общая» функция обрастает флагами ---
function formatPrice(value, { currency = 'RUB', withSpace = true, short = false, forEmail = false, roundUp = false } = {}) {
  let v = roundUp ? Math.ceil(value) : value;
  if (short && v >= 1000) return `${Math.round(v / 1000)}к`;
  const sign = forEmail ? (currency === 'RUB' ? 'руб.' : currency) : (currency === 'RUB' ? '₽' : '$');
  return withSpace ? `${v} ${sign}` : `${v}${sign}`;
}
const flags = formatPrice.toString().match(/\{ currency.*?\} = \{\}/)[0].split(',').length;
assert.equal(flags, 5);                                 // пять флагов — 32 сочетания поведения
assert.equal(2 ** flags, 32);
assert.equal(formatPrice(1200, { short: true, forEmail: true }), '1к'); // флаги начинают мешать друг другу: forEmail проигнорирован

console.log('thinking ok');
