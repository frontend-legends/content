// Проверки к 2.19: «разделяй и властвуй» — сбалансированное дерево из массива, сортировка списка
// слиянием, дерево квадрантов и слияние k списков; примеры и случайные тесты против простых решений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/19.divide-and-conquer
import { assert, fuzz, randArray, randInt, random, ListNode, TreeNode, toList, fromList } from '../_shared.ts';

// --- шаблон: сортировка слиянием массива ---
function mergeSort(nums: number[]): number[] {
  if (nums.length <= 1) return nums;
  const mid = nums.length >> 1;
  const left = mergeSort(nums.slice(0, mid));     // разделить
  const right = mergeSort(nums.slice(mid));
  const merged: number[] = [];                    // объединить
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) merged.push(left[i] <= right[j] ? left[i++] : right[j++]);
  return merged.concat(left.slice(i), right.slice(j));
}

// --- 108. Convert Sorted Array to Binary Search Tree ---
function sortedArrayToBST(nums: number[]): TreeNode | null {
  const build = (lo: number, hi: number): TreeNode | null => {
    if (lo > hi) return null;
    const mid = (lo + hi) >> 1;                   // середина — корень, половины — поддеревья
    return new TreeNode(nums[mid], build(lo, mid - 1), build(mid + 1, hi));
  };
  return build(0, nums.length - 1);
}

// --- слияние двух отсортированных списков (из 2.11) ---
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
  tail.next = a ?? b;
  return dummy.next;
}

// --- 148. Sort List ---
function sortList(head: ListNode | null): ListNode | null {
  if (!head || !head.next) return head;
  let slow = head;
  let fast = head.next;                           // с head.next — чтобы на двух узлах разрезать пополам
  while (fast && fast.next) {
    slow = slow.next!;
    fast = fast.next.next!;
  }
  const second = slow.next;
  slow.next = null;                               // разрезать список на две половины
  return mergeTwoLists(sortList(head), sortList(second));
}

// --- 427. Construct Quad Tree ---
class QuadNode {
  constructor(
    public val: boolean,
    public isLeaf: boolean,
    public topLeft: QuadNode | null = null,
    public topRight: QuadNode | null = null,
    public bottomLeft: QuadNode | null = null,
    public bottomRight: QuadNode | null = null,
  ) {}
}

function construct(grid: number[][]): QuadNode {
  const build = (r: number, c: number, size: number): QuadNode => {
    if (size === 1) return new QuadNode(grid[r][c] === 1, true);
    const half = size / 2;
    const tl = build(r, c, half);
    const tr = build(r, c + half, half);
    const bl = build(r + half, c, half);
    const br = build(r + half, c + half, half);
    const parts = [tl, tr, bl, br];
    if (parts.every((p) => p.isLeaf && p.val === tl.val)) return new QuadNode(tl.val, true);   // склеить одинаковые
    return new QuadNode(true, false, tl, tr, bl, br);
  };
  return build(0, 0, grid.length);
}

// --- 23. Merge k Sorted Lists ---
function mergeKLists(lists: (ListNode | null)[]): ListNode | null {
  if (lists.length === 0) return null;
  let round = lists;
  while (round.length > 1) {
    const next: (ListNode | null)[] = [];
    for (let i = 0; i < round.length; i += 2) next.push(mergeTwoLists(round[i], round[i + 1] ?? null));   // сливать попарно
    round = next;
  }
  return round[0];
}

// ===== проверки =====
const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

// шаблон
fuzz(500, () => randArray(randInt(0, 30), -50, 50), (xs) => assert.deepEqual(mergeSort(xs), asc(xs)));

// 108
const inorder = (t: TreeNode | null): number[] => (t ? [...inorder(t.left), t.val, ...inorder(t.right)] : []);
const height = (t: TreeNode | null): number => (t ? 1 + Math.max(height(t.left), height(t.right)) : 0);
const balanced = (t: TreeNode | null): boolean => !t || (Math.abs(height(t.left) - height(t.right)) <= 1 && balanced(t.left) && balanced(t.right));
for (let n = 0; n <= 200; n++) {
  const nums = Array.from({ length: n }, (_, i) => i * 3 - 100);
  const t = sortedArrayToBST(nums);
  assert.deepEqual(inorder(t), nums);
  assert.ok(balanced(t));
  assert.equal(height(t), n === 0 ? 0 : Math.floor(Math.log2(n)) + 1);                          // минимально возможная высота
}

// 148
assert.deepEqual(fromList(sortList(toList([4, 2, 1, 3]))), [1, 2, 3, 4]);
assert.deepEqual(fromList(sortList(toList([-1, 5, 3, 4, 0]))), [-1, 0, 3, 4, 5]);
assert.deepEqual(fromList(sortList(toList([]))), []);
fuzz(500, () => randArray(randInt(0, 40), -20, 20), (xs) => assert.deepEqual(fromList(sortList(toList(xs))), asc(xs)));
const big = randArray(100_000, 0, 1e9);
assert.deepEqual(fromList(sortList(toList(big))), asc(big));                                       // глубина рекурсии — log n

// 427
const covers = (node: QuadNode, grid: number[][], r: number, c: number, size: number): void => {
  if (node.isLeaf) {
    for (let i = r; i < r + size; i++) for (let j = c; j < c + size; j++) assert.equal(grid[i][j] === 1, node.val);
    return;
  }
  const h = size / 2;
  const kids = [node.topLeft!, node.topRight!, node.bottomLeft!, node.bottomRight!];
  assert.ok(!kids.every((k) => k.isLeaf && k.val === kids[0].val));                                 // одинаковые листья склеены
  covers(kids[0], grid, r, c, h); covers(kids[1], grid, r, c + h, h); covers(kids[2], grid, r + h, c, h); covers(kids[3], grid, r + h, c + h, h);
};
assert.equal(construct([[0, 1], [1, 0]]).isLeaf, false);
assert.deepEqual(construct([[1, 1], [1, 1]]), new QuadNode(true, true));
fuzz(300, () => { const size = 2 ** randInt(0, 4); const p = random(); return Array.from({ length: size }, () => Array.from({ length: size }, () => (random() < p ? 1 : 0))); }, (grid) => covers(construct(grid), grid, 0, 0, grid.length));

// 23
assert.deepEqual(fromList(mergeKLists([[1, 4, 5], [1, 3, 4], [2, 6]].map(toList))), [1, 1, 2, 3, 4, 4, 5, 6]);
assert.equal(mergeKLists([]), null);
assert.equal(mergeKLists([null]), null);
fuzz(500, () => Array.from({ length: randInt(0, 7) }, () => asc(randArray(randInt(0, 6), -10, 10))), (arrays) => {
  assert.deepEqual(fromList(mergeKLists(arrays.map(toList))), asc(arrays.flat()));
});

console.log('divide and conquer ok');
