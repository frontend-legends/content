// Проверка к 19.15: метод решения на одной задаче — chunk(array, size). Уточняющие вопросы превращаются в
// таблицу примеров, и прогон этой таблицы ловит ошибки наивной версии: при size = 0 и size < 0 — бесконечный
// цикл (ловим таймаутом node:vm), при дробном size — куски разной длины. Исправленная версия сверена с lodash.chunk.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const lodashChunk = createRequire(import.meta.url)('lodash/chunk.js');

// шаг 3: наивное рабочее решение — пишется первым
const naiveSource = `
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}`;
const runNaive = (arr, size) => vm.runInNewContext(`${naiveSource}; chunk(arr, size)`, { arr, size }, { timeout: 200 });

// шаг 5: краевые случаи из уточняющих вопросов
assert.deepEqual(JSON.parse(JSON.stringify(runNaive([1, 2, 3, 4, 5], 2))), [[1, 2], [3, 4], [5]]); // обычный пример работает
assert.throws(() => runNaive([1, 2, 3], 0), /Script execution timed out/);   // size = 0 — бесконечный цикл
assert.throws(() => runNaive([1, 2, 3], -1), /Script execution timed out/);  // отрицательный — тоже
assert.deepEqual(JSON.parse(JSON.stringify(runNaive([1, 2, 3, 4, 5], 2.5))), [[1, 2], [3, 4, 5]]); // дробный: куски разной длины

// шаг 4–5: исправленная версия — договорились вести себя как lodash: размер — целая часть, меньше 1 — пустой результат
function chunk(arr, size) {
  const n = Math.trunc(size);
  if (!Array.isArray(arr) || !(n >= 1)) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
const examples = [
  [[1, 2, 3, 4, 5], 2], [[1, 2, 3, 4], 2], [[], 3], [[1, 2, 3], 0], [[1, 2, 3], -1],
  [[1, 2, 3, 4, 5], 2.5], [[1, 2, 3], 10], [[1, 2, 3], NaN], [[1, 2, 3], 1],
];
for (const [arr, size] of examples) assert.deepEqual(chunk(arr, size), lodashChunk(arr, size), `chunk(${JSON.stringify(arr)}, ${size})`);
assert.deepEqual(chunk([1, 2, 3, 4, 5], 2.5), [[1, 2], [3, 4], [5]]); // дробный размер — как целый
assert.equal(NaN < 1, false);                       // поэтому проверка !(n >= 1), а не n < 1
const input = [1, 2, 3];
chunk(input, 2);
assert.deepEqual(input, [1, 2, 3]);                 // исходный массив не изменён

// шаг 6: оценка сложности — один проход и копия каждого элемента один раз, O(n)
let copied = 0;
const tracked = new Proxy([...Array(1000).keys()], { get(t, k, r) { if (k === 'slice') return (...a) => { const s = t.slice(...a); copied += s.length; return s; }; return Reflect.get(t, k, r); } });
chunk(tracked, 7);
assert.equal(copied, 1000);                         // каждый элемент скопирован ровно один раз

console.log('approach ok');
