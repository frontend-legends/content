// Проверки к 1.12 в Node: O(n·m) против O(n + m) на includes и Set, амортизированная стоимость
// удваивающегося массива, двоичный поиск за log2(n) шагов, законы де Моргана, методы Set,
// перекос sort(() => Math.random() - 0.5) и равномерность Фишера — Йетса, парадокс дней рождения для
// коротких идентификаторов, остаток от деления отрицательных, топологическая сортировка и поиск цикла.
// Запуск: cd codes && node run.mjs 01.computer-science/12.math-for-cs
import assert from 'node:assert/strict';

const time = (f) => { const t = performance.now(); f(); return performance.now() - t; };

// --- O(n·m) против O(n + m) ---
const n = 20000;
const orders = Array.from({ length: n }, (_, i) => ({ id: i, productId: i % 5000 }));
const hidden = Array.from({ length: n / 4 }, (_, i) => i * 2);
const slowFilter = () => orders.filter((o) => !hidden.includes(o.productId));
const fastFilter = () => { const set = new Set(hidden); return orders.filter((o) => !set.has(o.productId)); };
assert.deepEqual(fastFilter(), slowFilter());
assert.ok(time(slowFilter) > time(fastFilter) * 5);

// --- амортизация: массив, который удваивает ёмкость ---
class DynamicArray {
  capacity = 1; length = 0; copies = 0; data = new Array(1);
  push(x) {
    if (this.length === this.capacity) {
      this.capacity *= 2;
      const next = new Array(this.capacity);
      for (let i = 0; i < this.length; i++) { next[i] = this.data[i]; this.copies++; }
      this.data = next;
    }
    this.data[this.length++] = x;
  }
}
const dyn = new DynamicArray();
for (let i = 0; i < 1_000_000; i++) dyn.push(i);
assert.ok(dyn.copies < 2 * 1_000_000);                                                    // в среднем меньше двух копий на push
assert.equal(dyn.copies, 2 ** 20 - 1);                                                   // 1 + 2 + 4 + … + 2^19

// --- логарифм: двоичный поиск ---
function binarySearch(sorted, target) {
  let lo = 0, hi = sorted.length - 1, steps = 0;
  while (lo <= hi) {
    steps++;
    const mid = (lo + hi) >> 1;
    if (sorted[mid] === target) return { index: mid, steps };
    if (sorted[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return { index: -1, steps };
}
const million = Array.from({ length: 1e6 }, (_, i) => i * 2);
let worst = 0;
for (const t of [0, 1, 999_999 * 2, 123_456, 777_777 * 2, 3]) worst = Math.max(worst, binarySearch(million, t).steps);
assert.ok(worst <= Math.ceil(Math.log2(1e6)));                                            // ≤ 20 шагов
assert.equal(Math.ceil(Math.log2(1e6)), 20);

// --- логика: законы де Моргана на всей таблице истинности ---
for (const a of [true, false]) for (const b of [true, false]) {
  assert.equal(!(a && b), !a || !b);
  assert.equal(!(a || b), !a && !b);
}
// && и || возвращают операнд, а не boolean
assert.equal(0 || 'по умолчанию', 'по умолчанию');
assert.equal('' && 'не вычислится', '');

// --- множества ---
const tea = new Set(['улун', 'пуэр', 'сенча']);
const inStock = new Set(['пуэр', 'сенча', 'матча']);
assert.deepEqual([...tea.intersection(inStock)], ['пуэр', 'сенча']);
assert.deepEqual([...tea.union(inStock)], ['улун', 'пуэр', 'сенча', 'матча']);
assert.deepEqual([...tea.difference(inStock)], ['улун']);
assert.deepEqual([...tea.symmetricDifference(inStock)], ['улун', 'матча']);
assert.equal(new Set(['пуэр']).isSubsetOf(tea), true);

// --- перемешивание: sort со случайным компаратором перекошен ---
const runs = 60000;
const count = (shuffle) => {
  const c = {};
  for (let i = 0; i < runs; i++) { const k = shuffle([1, 2, 3]).join(''); c[k] = (c[k] ?? 0) + 1; }
  return c;
};
const biased = count((a) => a.sort(() => Math.random() - 0.5));
function fisherYates(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const fair = count(fisherYates);
const expected = runs / 6;
assert.equal(Object.keys(fair).length, 6);
for (const v of Object.values(fair)) assert.ok(Math.abs(v - expected) < expected * 0.1);   // каждая перестановка ≈ 1/6
assert.ok(biased['123'] / runs > 0.3, JSON.stringify(biased));                               // исходный порядок — около 37% вместо 16,7%

// --- парадокс дней рождения: 4 символа base36 — 1,68 млн кодов, совпадение уже после ~1600 ---
const space = 36 ** 4;
let total = 0;
for (let r = 0; r < 200; r++) {
  const seen = new Set();
  let k = 0;
  for (;;) { k++; const id = Math.floor(Math.random() * space); if (seen.has(id)) break; seen.add(id); }
  total += k;
}
const average = total / 200;
assert.ok(Math.abs(average - Math.sqrt((Math.PI * space) / 2)) < 300, `в среднем ${average}`);
const pCollision = (k, N) => 1 - Math.exp((-k * (k - 1)) / (2 * N));
assert.ok(pCollision(1000, space) > 0.25);                                                  // 1000 промокодов — уже больше 25%

// --- остаток от деления отрицательного ---
assert.equal(-1 % 5, -1);
const mod = (a, m) => ((a % m) + m) % m;
assert.deepEqual([mod(-1, 5), mod(5, 5), mod(7, 5), mod(-6, 5)], [4, 0, 2, 4]);

// половина вероятности совпадения — при k ≈ 1,18·√N
assert.equal(Math.round(Math.sqrt(2 * Math.log(2)) * 100) / 100, 1.18);
assert.ok(Math.abs(pCollision(1526, space) - 0.5) < 0.01);

// практика: pickRecommendations не трогает вход и возвращает count уникальных
function pickRecommendations(items, count) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, count);
}
const catalog = Array.from({ length: 50 }, (_, i) => i);
const picked = pickRecommendations(catalog, 5);
assert.equal(new Set(picked).size, 5);
assert.deepEqual(catalog, Array.from({ length: 50 }, (_, i) => i));
// практика: карусель
const prev = (i, k) => mod(i - 1, k), next = (i, k) => mod(i + 1, k);
assert.deepEqual([prev(0, 5), next(4, 5), mod(0 - 7, 5)], [4, 0, 3]);
assert.equal((0 - 1) % 5, -1);

// --- граф: топологическая сортировка и поиск цикла ---
function topoSort(graph) {
  const indegree = new Map(Object.keys(graph).map((k) => [k, 0]));
  for (const deps of Object.values(graph)) for (const d of deps) indegree.set(d, (indegree.get(d) ?? 0) + 1);
  const queue = [...indegree].filter(([, d]) => d === 0).map(([k]) => k);
  const order = [];
  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const d of graph[node] ?? []) { indegree.set(d, indegree.get(d) - 1); if (indegree.get(d) === 0) queue.push(d); }
  }
  if (order.length !== indegree.size) throw new Error('цикл: ' + [...indegree].filter(([, d]) => d > 0).map(([k]) => k).join(', '));
  return order.reverse();                                                                  // зависимости раньше зависящих
}
// «модуль: от кого зависит»
const modules = { app: ['cart', 'ui'], cart: ['api', 'ui'], ui: [], api: [] };
const buildOrder = topoSort(modules);
assert.deepEqual(buildOrder, ['ui', 'api', 'cart', 'app']);
for (const [m, deps] of Object.entries(modules)) for (const d of deps) assert.ok(buildOrder.indexOf(d) < buildOrder.indexOf(m));
assert.throws(() => topoSort({ app: ['cart'], cart: ['price'], price: ['cart'] }), /цикл: cart, price/);

console.log('math ok');
