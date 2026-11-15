// Глава 7.12 — асинхронные генераторы: постраничная загрузка, for await, break останавливает загрузку,
// Array.fromAsync.
// run: node async-generators.mjs
import assert from 'node:assert/strict';

const requested = [];
async function fetchPage(page) {
  requested.push(page);
  await new Promise((r) => setTimeout(r, 5));
  return { items: [`товар ${page * 2 - 1}`, `товар ${page * 2}`], hasMore: page < 5 };
}

async function* catalog() {
  let page = 1;
  try {
    while (true) {
      const { items, hasMore } = await fetchPage(page++);
      yield* items;
      if (!hasMore) return;
    }
  } finally {
    requested.push('finally');
  }
}

// нужны первые 3 товара — загрузятся только 2 страницы, и генератор будет закрыт
const firstThree = [];
for await (const item of catalog()) {
  firstThree.push(item);
  if (firstThree.length === 3) break;
}
assert.deepEqual(firstThree, ['товар 1', 'товар 2', 'товар 3']);
assert.deepEqual(requested, [1, 2, 'finally']);

// всё целиком
requested.length = 0;
const all = await Array.fromAsync(catalog());
assert.equal(all.length, 10);
assert.deepEqual(requested, [1, 2, 3, 4, 5, 'finally']);

// for await работает и с обычным массивом промисов — ждёт по порядку
const ordered = [];
for await (const v of [new Promise((r) => setTimeout(() => r('медленный'), 20)), Promise.resolve('быстрый')]) ordered.push(v);
assert.deepEqual(ordered, ['медленный', 'быстрый']);
console.log('ok');
