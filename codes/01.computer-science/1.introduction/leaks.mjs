// Проверки к 1.01: абстракции протекают. Цена 349.9 × 3 и 4.35 × 100 в double, Math.floor теряет копейку,
// сортировка чисел без компаратора сравнивает строки, includes в цикле — квадратичная сложность.
// Запуск: cd codes && node run.mjs 01.computer-science/1.introduction
import assert from 'node:assert/strict';

// --- числа: двоичный double ---
assert.equal(349.9 * 3, 1049.6999999999998);
assert.equal(0.1 + 0.2, 0.30000000000000004);
assert.equal(4.35 * 100, 434.99999999999994);
assert.equal(Math.floor(4.35 * 100), 434);                                                  // потеряна копейка
assert.equal(Math.round(4.35 * 100), 435);
const toKopecks = (rub) => Math.round(rub * 100);
const cart = [349.9, 349.9, 349.9].map(toKopecks);
assert.equal(cart.reduce((a, b) => a + b, 0), 104970);
assert.equal(new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(104970 / 100), '1 049,70 ₽');

// --- сортировка: по умолчанию строки ---
assert.deepEqual([10, 9, 1].sort(), [1, 10, 9]);
assert.deepEqual([10, 9, 1].toSorted((a, b) => a - b), [1, 9, 10]);

// --- сложность: includes в цикле ---
const ids = Array.from({ length: 20000 }, (_, i) => i);
const favorites = Array.from({ length: 5000 }, (_, i) => i * 3);
const time = (f) => { const t = performance.now(); f(); return performance.now() - t; };
const slow = () => ids.filter((id) => favorites.includes(id));
const fast = () => { const set = new Set(favorites); return ids.filter((id) => set.has(id)); };
assert.deepEqual(fast(), slow());
assert.ok(time(slow) > time(fast) * 5);

console.log('leaks ok');
