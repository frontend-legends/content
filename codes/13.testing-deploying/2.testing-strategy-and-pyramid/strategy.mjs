// Проверки к 13.02: тест на реализацию ломается при рефакторинге, тест на поведение — нет;
// модульные тесты с разными допущениями проходят, а интеграционный ловит несостыковку.
import assert from 'node:assert/strict';
import { vitest, write } from '../../_lib/project.mjs';

const cartV1 = `export class Cart {
  _items = [];
  add(id, qty = 1) {
    const found = this._items.find((i) => i.id === id);
    if (found) found.qty += qty; else this._items.push({ id, qty });
  }
  count() { return this._items.reduce((s, i) => s + i.qty, 0); }
}
`;
// рефакторинг: Map вместо массива, поведение то же
const cartV2 = `export class Cart {
  #items = new Map();
  add(id, qty = 1) { this.#items.set(id, (this.#items.get(id) ?? 0) + qty); }
  count() { let s = 0; for (const q of this.#items.values()) s += q; return s; }
}
`;
const tests = `import { test, expect } from 'vitest';
import { Cart } from './cart.js';

test('реализация: повторный товар не добавляет элемент в _items', () => {
  const cart = new Cart();
  cart.add('tea'); cart.add('tea');
  expect(cart._items).toHaveLength(1);
  expect(cart._items[0].qty).toBe(2);
});

test('поведение: два раза один товар — два в корзине', () => {
  const cart = new Cart();
  cart.add('tea'); cart.add('tea'); cart.add('cup', 3);
  expect(cart.count()).toBe(5);
});
`;
const before = vitest({ 'cart.js': cartV1, 'cart.test.js': tests });
assert.equal(before.numPassedTests, 2);

const after = vitest({ 'cart.js': cartV2 }, { dir: before.dir });
const status = Object.fromEntries(after.tests.map((t) => [t.name.split(':')[0], t.status]));
assert.deepEqual(status, { 'реализация': 'failed', 'поведение': 'passed' });

// --- модульные тесты проходят, связка сломана ---
// API отдаёт цену в копейках, а formatPrice ждёт рубли
const api = `export async function fetchProduct(id) {
  return { id, title: 'Пуэр', price: 120000 }; // копейки
}
`;
const format = `export const formatPrice = (rub) => new Intl.NumberFormat('ru', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(rub);
`;
const card = `import { fetchProduct } from './api.js';
import { formatPrice } from './format.js';
export async function productCard(id) {
  const p = await fetchProduct(id);
  return \`\${p.title} — \${formatPrice(p.price)}\`;
}
`;
const unit = `import { test, expect, vi } from 'vitest';
import { formatPrice } from './format.js';
vi.mock('./api.js', () => ({ fetchProduct: async (id) => ({ id, title: 'Пуэр', price: 1200 }) }));
import { productCard } from './card.js';

test('formatPrice форматирует рубли', () => {
  expect(formatPrice(1200)).toBe('1\\u00a0200\\u00a0₽');
});
test('productCard собирает строку (API замокан)', async () => {
  expect(await productCard(7)).toBe('Пуэр — 1\\u00a0200\\u00a0₽');
});
`;
const integration = `import { test, expect } from 'vitest';
import { productCard } from './card.js';
test('карточка с настоящим модулем API', async () => {
  expect(await productCard(7)).toBe('Пуэр — 1\\u00a0200\\u00a0₽');
});
`;
const units = vitest({ 'api.js': api, 'format.js': format, 'card.js': card, 'unit.test.js': unit });
assert.equal(units.numPassedTests, 2);
assert.equal(units.numFailedTests, 0);

const both = vitest({ 'integration.test.js': integration }, { dir: units.dir });
const failed = both.tests.filter((t) => t.status === 'failed');
assert.equal(failed.length, 1);
assert.equal(failed[0].name, 'карточка с настоящим модулем API');
assert.match(failed[0].failureMessages[0], /120 000 ₽/);

console.log('strategy ok');
