// Проверки к 2.11: фиктивный узел, быстрый и медленный указатели, разворот, слияние, копирование
// со случайными ссылками и LRU-кеш — примеры из условий и случайные тесты против решений на массивах.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/11.linked-list
import { assert, fuzz, randArray, randInt, ListNode, toList, fromList } from '../_shared.ts';

// --- шаблоны ---
function reverseList(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let node = head;
  while (node) {
    const next = node.next;                       // запомнить хвост
    node.next = prev;                             // развернуть стрелку
    prev = node;
    node = next;
  }
  return prev;
}

function middleNode(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow!.next;                            // шаг на один
    fast = fast.next.next;                        // шаг на два
  }
  return slow;
}

// --- 141. Linked List Cycle ---
function hasCycle(head: ListNode | null): boolean {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// --- 2. Add Two Numbers ---
function addTwoNumbers(l1: ListNode | null, l2: ListNode | null): ListNode | null {
  const dummy = new ListNode();
  let tail = dummy;
  let carry = 0;
  while (l1 || l2 || carry) {
    const sum = (l1?.val ?? 0) + (l2?.val ?? 0) + carry;
    carry = Math.floor(sum / 10);
    tail.next = new ListNode(sum % 10);
    tail = tail.next;
    l1 = l1?.next ?? null;
    l2 = l2?.next ?? null;
  }
  return dummy.next;
}

// --- 21. Merge Two Sorted Lists ---
function mergeTwoLists(a: ListNode | null, b: ListNode | null): ListNode | null {
  const dummy = new ListNode();
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a ?? b;                             // остаток одного из списков
  return dummy.next;
}

// --- 138. Copy List with Random Pointer ---
class Node {
  val: number;
  next: Node | null;
  random: Node | null;
  constructor(val?: number, next?: Node | null, random?: Node | null) {
    this.val = val ?? 0;
    this.next = next ?? null;
    this.random = random ?? null;
  }
}

function copyRandomList(head: Node | null): Node | null {
  const copies = new Map<Node, Node>();
  for (let n = head; n; n = n.next) copies.set(n, new Node(n.val));
  for (let n = head; n; n = n.next) {
    const copy = copies.get(n)!;
    copy.next = n.next ? copies.get(n.next)! : null;
    copy.random = n.random ? copies.get(n.random)! : null;
  }
  return head ? copies.get(head)! : null;
}

// --- 92. Reverse Linked List II ---
function reverseBetween(head: ListNode | null, left: number, right: number): ListNode | null {
  const dummy = new ListNode(0, head);
  let before = dummy;
  for (let i = 1; i < left; i++) before = before.next!;     // узел перед отрезком
  const start = before.next!;
  for (let i = 0; i < right - left; i++) {
    const moved = start.next!;                    // следующий за start переносим в начало отрезка
    start.next = moved.next;
    moved.next = before.next;
    before.next = moved;
  }
  return dummy.next;
}

// --- 25. Reverse Nodes in k-Group ---
function reverseKGroup(head: ListNode | null, k: number): ListNode | null {
  const dummy = new ListNode(0, head);
  let before = dummy;
  for (;;) {
    let check = before;
    for (let i = 0; i < k && check; i++) check = check.next!;
    if (!check) break;                            // в остатке меньше k узлов
    const start = before.next!;
    for (let i = 0; i < k - 1; i++) {
      const moved = start.next!;
      start.next = moved.next;
      moved.next = before.next;
      before.next = moved;
    }
    before = start;                               // start стал концом группы
  }
  return dummy.next;
}

// --- 19. Remove Nth Node From End of List ---
function removeNthFromEnd(head: ListNode | null, n: number): ListNode | null {
  const dummy = new ListNode(0, head);
  let fast: ListNode | null = dummy;
  let slow: ListNode = dummy;
  for (let i = 0; i <= n; i++) fast = fast!.next;           // разрыв в n + 1 узел
  while (fast) {
    fast = fast.next;
    slow = slow.next!;
  }
  slow.next = slow.next!.next;                    // slow — перед удаляемым
  return dummy.next;
}

// --- 82. Remove Duplicates from Sorted List II ---
function deleteDuplicates(head: ListNode | null): ListNode | null {
  const dummy = new ListNode(0, head);
  let prev = dummy;
  let node = head;
  while (node) {
    if (node.next && node.next.val === node.val) {
      const v = node.val;
      while (node && node.val === v) node = node.next;    // пропустить все копии
      prev.next = node;
    } else {
      prev = node;
      node = node.next;
    }
  }
  return dummy.next;
}

// --- 61. Rotate List ---
function rotateRight(head: ListNode | null, k: number): ListNode | null {
  if (!head || !head.next) return head;
  let length = 1;
  let tail = head;
  while (tail.next) {
    tail = tail.next;
    length++;
  }
  k %= length;
  if (k === 0) return head;
  tail.next = head;                               // замкнуть в кольцо
  let newTail = head;
  for (let i = 0; i < length - k - 1; i++) newTail = newTail.next!;
  const newHead = newTail.next;
  newTail.next = null;                            // разрезать
  return newHead;
}

// --- 86. Partition List ---
function partition(head: ListNode | null, x: number): ListNode | null {
  const lessDummy = new ListNode();
  const restDummy = new ListNode();
  let less = lessDummy;
  let rest = restDummy;
  for (let node = head; node; node = node.next) {
    if (node.val < x) less = less.next = node;
    else rest = rest.next = node;
  }
  rest.next = null;                               // иначе может остаться цикл
  less.next = restDummy.next;
  return lessDummy.next;
}

// --- 146. LRU Cache ---
class LRUCache {
  private map = new Map<number, number>();       // Map помнит порядок вставки
  constructor(private capacity: number) {}

  get(key: number): number {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key)!;
    this.map.delete(key);                         // переставить в конец — самый свежий
    this.map.set(key, value);
    return value;
  }

  put(key: number, value: number): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value!);   // первый — самый давний
    }
  }
}

// ===== проверки =====
const list = (a: number[]) => toList(a);
fuzz(500, () => randArray(randInt(0, 8), 0, 9), (a) => {
  assert.deepEqual(fromList(reverseList(list(a))), [...a].reverse());
  if (a.length) assert.equal(middleNode(list(a))!.val, a[Math.floor(a.length / 2)]);    // при чётной длине — второй из средних
});

// 141
const cyc = list([3, 2, 0, -4]);
cyc!.next!.next!.next!.next = cyc!.next;
assert.equal(hasCycle(cyc), true);
assert.equal(hasCycle(list([1, 2])), false);
assert.equal(hasCycle(null), false);
fuzz(500, () => [randInt(1, 8), randInt(-1, 7)] as const, ([n, pos]) => {
  const head = list(Array.from({ length: n }, (_, i) => i));
  let tail = head!; while (tail.next) tail = tail.next;
  const p = pos < n ? pos : -1;
  if (p >= 0) { let t = head!; for (let i = 0; i < p; i++) t = t.next!; tail.next = t; }
  assert.equal(hasCycle(head), p >= 0);
});

// 2
assert.deepEqual(fromList(addTwoNumbers(list([2, 4, 3]), list([5, 6, 4]))), [7, 0, 8]);
assert.deepEqual(fromList(addTwoNumbers(list([9, 9, 9, 9, 9, 9, 9]), list([9, 9, 9, 9]))), [8, 9, 9, 9, 0, 0, 0, 1]);
const digits = () => { const d = randArray(randInt(1, 8), 0, 9); if (d.length > 1 && d.at(-1) === 0) d[d.length - 1] = randInt(1, 9); return d; };   // без ведущих нулей
fuzz(1000, () => [digits(), digits()] as const, ([a, b]) => {
  const num = (d: number[]) => BigInt([...d].reverse().join(''));
  const sum = (num(a) + num(b)).toString().split('').reverse().map(Number);
  assert.deepEqual(fromList(addTwoNumbers(list(a), list(b))), sum);
});

// 21
assert.deepEqual(fromList(mergeTwoLists(list([1, 2, 4]), list([1, 3, 4]))), [1, 1, 2, 3, 4, 4]);
fuzz(1000, () => [randArray(randInt(0, 6), 0, 9).sort((x, y) => x - y), randArray(randInt(0, 6), 0, 9).sort((x, y) => x - y)] as const, ([a, b]) => {
  assert.deepEqual(fromList(mergeTwoLists(list(a), list(b))), [...a, ...b].sort((x, y) => x - y));
});

// 138
fuzz(300, () => { const n = randInt(0, 6); return { vals: randArray(n, 0, 9), rnd: Array.from({ length: n }, () => randInt(-1, n - 1)) }; }, ({ vals, rnd }) => {
  const nodes = vals.map((v) => new Node(v));
  nodes.forEach((n, i) => { n.next = nodes[i + 1] ?? null; n.random = rnd[i] >= 0 ? nodes[rnd[i]] : null; });
  const copy = copyRandomList(nodes[0] ?? null);
  const copied: Node[] = [];
  for (let c = copy; c; c = c.next) copied.push(c);
  assert.deepEqual(copied.map((c) => c.val), vals);
  copied.forEach((c, i) => {
    assert.ok(!nodes.includes(c));                                                                // новые узлы
    assert.equal(c.random ? copied.indexOf(c.random) : -1, rnd[i]);                                // ссылки внутри копии
  });
});

// 92
assert.deepEqual(fromList(reverseBetween(list([1, 2, 3, 4, 5]), 2, 4)), [1, 4, 3, 2, 5]);
assert.deepEqual(fromList(reverseBetween(list([5]), 1, 1)), [5]);
fuzz(1000, () => { const a = randArray(randInt(1, 8), 0, 9); const l = randInt(1, a.length); return [a, l, randInt(l, a.length)] as const; }, ([a, l, r]) => {
  assert.deepEqual(fromList(reverseBetween(list(a), l, r)), [...a.slice(0, l - 1), ...a.slice(l - 1, r).reverse(), ...a.slice(r)]);
});

// 25
assert.deepEqual(fromList(reverseKGroup(list([1, 2, 3, 4, 5]), 2)), [2, 1, 4, 3, 5]);
assert.deepEqual(fromList(reverseKGroup(list([1, 2, 3, 4, 5]), 3)), [3, 2, 1, 4, 5]);
fuzz(1000, () => [randArray(randInt(1, 10), 0, 9), randInt(1, 4)] as const, ([a, k]) => {
  const expected: number[] = [];
  for (let i = 0; i < a.length; i += k) { const g = a.slice(i, i + k); expected.push(...(g.length === k ? g.reverse() : g)); }
  assert.deepEqual(fromList(reverseKGroup(list(a), k)), expected);
});

// 19
assert.deepEqual(fromList(removeNthFromEnd(list([1, 2, 3, 4, 5]), 2)), [1, 2, 3, 5]);
assert.deepEqual(fromList(removeNthFromEnd(list([1]), 1)), []);
fuzz(1000, () => { const a = randArray(randInt(1, 8), 0, 9); return [a, randInt(1, a.length)] as const; }, ([a, n]) => {
  assert.deepEqual(fromList(removeNthFromEnd(list(a), n)), a.filter((_, i) => i !== a.length - n));
});

// 82
assert.deepEqual(fromList(deleteDuplicates(list([1, 2, 3, 3, 4, 4, 5]))), [1, 2, 5]);
assert.deepEqual(fromList(deleteDuplicates(list([1, 1, 1, 2, 3]))), [2, 3]);
fuzz(1000, () => randArray(randInt(0, 10), 0, 4).sort((x, y) => x - y), (a) => {
  assert.deepEqual(fromList(deleteDuplicates(list(a))), a.filter((x) => a.indexOf(x) === a.lastIndexOf(x)));
});

// 61
assert.deepEqual(fromList(rotateRight(list([1, 2, 3, 4, 5]), 2)), [4, 5, 1, 2, 3]);
assert.deepEqual(fromList(rotateRight(list([0, 1, 2]), 4)), [2, 0, 1]);
fuzz(1000, () => [randArray(randInt(0, 7), 0, 9), randInt(0, 20)] as const, ([a, k]) => {
  const s = a.length ? k % a.length : 0;
  assert.deepEqual(fromList(rotateRight(list(a), k)), [...a.slice(a.length - s), ...a.slice(0, a.length - s)]);
});

// 86
assert.deepEqual(fromList(partition(list([1, 4, 3, 2, 5, 2]), 3)), [1, 2, 2, 4, 3, 5]);
assert.deepEqual(fromList(partition(list([2, 1]), 2)), [1, 2]);
fuzz(1000, () => [randArray(randInt(0, 8), 0, 9), randInt(0, 9)] as const, ([a, x]) => {
  assert.deepEqual(fromList(partition(list(a), x)), [...a.filter((v) => v < x), ...a.filter((v) => v >= x)]);
});

// 146
const lru = new LRUCache(2);
lru.put(1, 1); lru.put(2, 2);
assert.equal(lru.get(1), 1);
lru.put(3, 3);                                                                                     // вытесняет 2
assert.equal(lru.get(2), -1);
lru.put(4, 4);                                                                                     // вытесняет 1
assert.deepEqual([lru.get(1), lru.get(3), lru.get(4)], [-1, 3, 4]);
fuzz(300, () => [randInt(1, 3), Array.from({ length: 30 }, () => [randInt(0, 1), randInt(0, 4), randInt(0, 9)])] as const, ([cap, ops]) => {
  const c = new LRUCache(cap);
  let model: [number, number][] = [];
  for (const [op, key, value] of ops) {
    if (op === 0) {
      const i = model.findIndex(([k]) => k === key);
      const expected = i < 0 ? -1 : model[i][1];
      if (i >= 0) model = [...model.slice(0, i), ...model.slice(i + 1), model[i]];
      assert.equal(c.get(key), expected);
    } else {
      model = [...model.filter(([k]) => k !== key), [key, value]];
      if (model.length > cap) model.shift();
      c.put(key, value);
    }
  }
});

// начало цикла из текста: после встречи — один указатель в голову, оба по шагу
function detectCycle(head: ListNode | null): ListNode | null {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow!.next; fast = fast.next.next;
    if (slow === fast) { let p = head; while (p !== slow) { p = p!.next; slow = slow!.next; } return p; }
  }
  return null;
}
fuzz(500, () => [randInt(1, 9), randInt(0, 8)] as const, ([n, pos]) => {
  const nodes = Array.from({ length: n }, (_, i) => new ListNode(i));
  nodes.forEach((x, i) => { x.next = nodes[i + 1] ?? null; });
  const p = pos % n;
  nodes[n - 1].next = nodes[p];
  assert.equal(detectCycle(nodes[0]), nodes[p]);
});

console.log('linked list ok');
