// Проверки к 19.01: пример из текста — compact со спецификацией из уточняющих вопросов
// (не мутирует, пустой массив → [], убирает все falsy), и что сложность важна и на фронтенд-задаче:
// дедупликация через indexOf — O(n²), через Set — O(n), результат одинаковый.
import assert from 'node:assert/strict';

function compact(arr) {
  return arr.filter(Boolean);
}
const input = [0, 1, false, 2, '', 3, null, undefined, NaN, 'a'];
const copy = [...input];
assert.deepEqual(compact(input), [1, 2, 3, 'a']);   // все falsy убраны, включая NaN
assert.deepEqual(input, copy);                      // исходный массив не изменился
assert.deepEqual(compact([]), []);                  // краевой случай из уточнения
assert.notEqual(compact(input), input);             // новый массив, а не тот же

// --- сложность: одна и та же задача за O(n²) и за O(n) ---
const uniqueSlow = (arr) => arr.filter((x, i) => arr.indexOf(x) === i); // indexOf внутри filter — квадрат
const uniqueFast = (arr) => [...new Set(arr)];
const data = Array.from({ length: 20000 }, (_, i) => i % 5000);
const time = (fn) => { const t = performance.now(); const r = fn(data); return { r, ms: performance.now() - t }; };
const slow = time(uniqueSlow), fast = time(uniqueFast);
assert.deepEqual(slow.r, fast.r);                   // ответ тот же
assert.equal(fast.r.length, 5000);
assert.ok(slow.ms > fast.ms * 10, `indexOf ${slow.ms.toFixed(1)} мс против Set ${fast.ms.toFixed(1)} мс`);

console.log('intro ok');
