// Проверки к 2.1: устройство структур данных — дек на кольцевом буфере, хеш-таблица с цепочками и
// перестроением, AVL-дерево с поворотами и дерево Фенвика; сравнение со встроенными структурами и
// перебором на случайных операциях.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/1.data-structures
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- дек на кольцевом буфере ---
class RingDeque<T> {
  private buffer: (T | undefined)[] = new Array(4);
  private head = 0;                               // индекс первого элемента
  size = 0;

  private grow(): void {
    const old = this.buffer;
    this.buffer = new Array(old.length * 2);
    for (let i = 0; i < this.size; i++) this.buffer[i] = old[(this.head + i) % old.length];   // развернуть кольцо
    this.head = 0;
  }

  pushBack(value: T): void {
    if (this.size === this.buffer.length) this.grow();
    this.buffer[(this.head + this.size) % this.buffer.length] = value;
    this.size++;
  }

  pushFront(value: T): void {
    if (this.size === this.buffer.length) this.grow();
    this.head = (this.head - 1 + this.buffer.length) % this.buffer.length;   // шаг назад по кольцу
    this.buffer[this.head] = value;
    this.size++;
  }

  popFront(): T | undefined {
    if (this.size === 0) return undefined;
    const value = this.buffer[this.head];
    this.buffer[this.head] = undefined;           // не держать ссылку — иначе утечка
    this.head = (this.head + 1) % this.buffer.length;
    this.size--;
    return value;
  }

  popBack(): T | undefined {
    if (this.size === 0) return undefined;
    const i = (this.head + this.size - 1) % this.buffer.length;
    const value = this.buffer[i];
    this.buffer[i] = undefined;
    this.size--;
    return value;
  }
}

// --- хеш-таблица с цепочками ---
class HashTable<V> {
  private buckets: [string, V][][] = Array.from({ length: 8 }, () => []);
  size = 0;
  resizes = 0;

  constructor(private hash: (key: string) => number = HashTable.fnv1a) {}

  static fnv1a(key: string): number {             // простой хеш строк: FNV-1a, 32 бита
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }

  private bucket(key: string): [string, V][] {
    return this.buckets[this.hash(key) % this.buckets.length];
  }

  set(key: string, value: V): void {
    const bucket = this.bucket(key);
    const entry = bucket.find(([k]) => k === key);
    if (entry) {
      entry[1] = value;
      return;
    }
    bucket.push([key, value]);
    this.size++;
    if (this.size > this.buckets.length * 0.75) this.rehash();   // коэффициент заполнения выше 0.75
  }

  get(key: string): V | undefined {
    return this.bucket(key).find(([k]) => k === key)?.[1];
  }

  delete(key: string): boolean {
    const bucket = this.bucket(key);
    const i = bucket.findIndex(([k]) => k === key);
    if (i === -1) return false;
    bucket.splice(i, 1);
    this.size--;
    return true;
  }

  private rehash(): void {
    const entries = this.buckets.flat();
    this.buckets = Array.from({ length: this.buckets.length * 2 }, () => []);
    for (const [k, v] of entries) this.bucket(k).push([k, v]);   // позиции меняются: другой модуль
    this.resizes++;
  }

  longestChain(): number {
    return Math.max(...this.buckets.map((b) => b.length));
  }
}

// --- AVL-дерево ---
type AvlNode = { key: number; height: number; left: AvlNode | null; right: AvlNode | null };

const height = (n: AvlNode | null) => n?.height ?? 0;
const update = (n: AvlNode) => {
  n.height = 1 + Math.max(height(n.left), height(n.right));
};

function rotateRight(y: AvlNode): AvlNode {
  const x = y.left!;                              //     y        x
  y.left = x.right;                               //    /    →     \
  x.right = y;                                    //   x            y
  update(y);
  update(x);
  return x;
}

function rotateLeft(x: AvlNode): AvlNode {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  update(x);
  update(y);
  return y;
}

function avlInsert(node: AvlNode | null, key: number): AvlNode {
  if (!node) return { key, height: 1, left: null, right: null };
  if (key < node.key) node.left = avlInsert(node.left, key);
  else if (key > node.key) node.right = avlInsert(node.right, key);
  else return node;
  update(node);
  const balance = height(node.left) - height(node.right);
  if (balance > 1) {                              // перевес слева
    if (key > node.left!.key) node.left = rotateLeft(node.left!);   // случай «лево-право»
    return rotateRight(node);
  }
  if (balance < -1) {                             // перевес справа
    if (key < node.right!.key) node.right = rotateRight(node.right!);
    return rotateLeft(node);
  }
  return node;
}

// --- дерево Фенвика: префиксные суммы с изменением элементов ---
class Fenwick {
  private tree: number[];

  constructor(n: number) {
    this.tree = new Array(n + 1).fill(0);         // индексы с 1
  }

  add(i: number, delta: number): void {
    for (i++; i < this.tree.length; i += i & -i) this.tree[i] += delta;   // вверх по ответственным узлам
  }

  prefixSum(i: number): number {                  // сумма элементов 0..i
    let sum = 0;
    for (i++; i > 0; i -= i & -i) sum += this.tree[i];   // сбросить младшую единицу
    return sum;
  }
}

// --- сумма на отрезке через дерево Фенвика ---
function rangeSum(fenwick: Fenwick, l: number, r: number): number {
  return fenwick.prefixSum(r) - (l > 0 ? fenwick.prefixSum(l - 1) : 0);   // [l, r] = [0, r] − [0, l − 1]
}

// --- очередь на двух стеках ---
class TwoStackQueue<T> {
  private inbox: T[] = [];
  private outbox: T[] = [];

  enqueue(value: T): void {
    this.inbox.push(value);
  }

  dequeue(): T | undefined {
    if (this.outbox.length === 0) {
      while (this.inbox.length) this.outbox.push(this.inbox.pop()!);   // переложить — порядок развернётся
    }
    return this.outbox.pop();
  }
}

// ===== проверки =====
// дек: случайные операции против массива
fuzz(500, () => Array.from({ length: 60 }, () => [randInt(0, 3), randInt(0, 99)] as const), (ops) => {
  const d = new RingDeque<number>();
  const ref: number[] = [];
  for (const [op, v] of ops) {
    if (op === 0) { d.pushBack(v); ref.push(v); }
    else if (op === 1) { d.pushFront(v); ref.unshift(v); }
    else if (op === 2) assert.equal(d.popFront(), ref.shift());
    else assert.equal(d.popBack(), ref.pop());
    assert.equal(d.size, ref.length);
  }
});
// очередь из 200 000 элементов через дек — без квадратичного сдвига
{
  const d = new RingDeque<number>();
  const t = performance.now();
  for (let i = 0; i < 200_000; i++) d.pushBack(i);
  let sum = 0;
  while (d.size) sum += d.popFront()!;
  assert.equal(sum, (199_999 * 200_000) / 2);
  assert.ok(performance.now() - t < 500);
}

// очередь на двух стеках: порядок FIFO и каждый элемент перекладывается один раз
fuzz(500, () => Array.from({ length: 60 }, () => [randInt(0, 1), randInt(0, 99)] as const), (ops) => {
  const q = new TwoStackQueue<number>();
  const ref: number[] = [];
  for (const [op, v] of ops) {
    if (op === 0) { q.enqueue(v); ref.push(v); }
    else assert.equal(q.dequeue(), ref.shift());
  }
});

// хеш-таблица против Map
fuzz(300, () => Array.from({ length: 200 }, () => [randInt(0, 2), `k${randInt(0, 60)}`, randInt(0, 9)] as const), (ops) => {
  const h = new HashTable<number>();
  const ref = new Map<string, number>();
  for (const [op, k, v] of ops) {
    if (op === 0) { h.set(k, v); ref.set(k, v); }
    else if (op === 1) assert.equal(h.delete(k), ref.delete(k));
    else assert.equal(h.get(k), ref.get(k));
    assert.equal(h.size, ref.size);
  }
});
{
  const good = new HashTable<number>();
  for (let i = 0; i < 10_000; i++) good.set(`user-${i}`, i);
  assert.equal(good.resizes, 11);                                                                   // 8 → 16384 корзин
  assert.ok(good.longestChain() <= 8);                                                              // цепочки короткие
  const bad = new HashTable<number>(() => 42);                                                      // все ключи в одну корзину
  for (let i = 0; i < 2_000; i++) bad.set(`user-${i}`, i);
  assert.equal(bad.longestChain(), 2_000);                                                          // поиск — O(n)
  assert.equal(bad.get('user-1999'), 1999);
}

// AVL: порядок, баланс и высота
const inorder = (n: AvlNode | null): number[] => (n ? [...inorder(n.left), n.key, ...inorder(n.right)] : []);
const balanced = (n: AvlNode | null): boolean => !n || (Math.abs(height(n.left) - height(n.right)) <= 1 && balanced(n.left) && balanced(n.right));
fuzz(300, () => randArray(randInt(0, 200), 0, 300), (keys) => {
  let root: AvlNode | null = null;
  for (const k of keys) root = avlInsert(root, k);
  assert.deepEqual(inorder(root), [...new Set(keys)].sort((a, b) => a - b));
  assert.ok(balanced(root));
});
{
  let root: AvlNode | null = null;
  for (let k = 1; k <= 100_000; k++) root = avlInsert(root, k);                                     // отсортированные вставки
  assert.equal(height(root), 17);                                                                   // обычное BST дало бы 100 000
  assert.ok(height(root) <= 1.44 * Math.log2(100_000 + 2));
}

// Фенвик против перебора
fuzz(300, () => ({ n: randInt(1, 30), ops: Array.from({ length: 50 }, () => [randInt(0, 1), randInt(0, 29), randInt(-5, 5)] as const) }), ({ n, ops }) => {
  const f = new Fenwick(n);
  const arr = new Array(n).fill(0);
  for (const [op, raw, v] of ops) {
    const i = raw % n;
    if (op === 0) { f.add(i, v); arr[i] += v; }
    else {
      assert.equal(f.prefixSum(i), arr.slice(0, i + 1).reduce((a, b) => a + b, 0));
      const l = randInt(0, i);
      assert.equal(rangeSum(f, l, i), arr.slice(l, i + 1).reduce((a, b) => a + b, 0));
    }
  }
});

// пример из практики: цены по дням, изменение и сумма за неделю
{
  const prices = [5, 3, 8, 6, 2, 7, 4, 9];
  const fenwick = new Fenwick(prices.length);
  prices.forEach((p, i) => fenwick.add(i, p));
  rangeSum(fenwick, 1, 4);                        // 3 + 8 + 6 + 2 = 19
  fenwick.add(2, -5);                             // цена дня 2: 8 → 3
  rangeSum(fenwick, 1, 4);                        // 14
  assert.equal(rangeSum(fenwick, 1, 4), 14);
  fenwick.add(2, 5);
  assert.equal(rangeSum(fenwick, 1, 4), 19);
}

console.log('data structures ok');
