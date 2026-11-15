// Глава 8.01 — код, который проходит проверку типов, но падает при выполнении: TypeScript проверяет
// только то, что знает. Запускается через tsx, типы проверяет tsc.
import assert from 'node:assert/strict';

interface Product { id: number; title: string }

// 1. данные из сети: тип — обещание, а не проверка
const fromServer = JSON.parse('{"id":"7"}') as Product;
assert.equal(typeof fromServer.id, 'string');           // в рантайме строка
assert.throws(() => fromServer.title.toUpperCase(), TypeError);

// 2. индекс массива без noUncheckedIndexedAccess
const titles: string[] = [];
assert.throws(() => titles[0].toUpperCase(), TypeError);

// 3. изменяемый массив: присваивание подтипа делает запись небезопасной
type Animal = { name: string };
type Cat = Animal & { meow(): string };
const cats: Cat[] = [];
const animals: Animal[] = cats;                          // разрешено: массивы ковариантны
animals.push({ name: 'Пёс' });                           // и запись тоже разрешена
assert.throws(() => cats[0].meow(), TypeError);

// 4. методы проверяются бивариантно
interface Handler { handle(e: { type: string }): void }
const clickOnly: Handler = { handle(e: { type: string; x: number }) { void e.x.toFixed(0); } };
assert.throws(() => clickOnly.handle({ type: 'scroll' }), TypeError);
console.log('ok');
