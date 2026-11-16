// Проверки к 2.12: рекурсия по дереву «ответ из ответов детей», построение по обходам, изменение
// ссылок на месте, итератор и общий предок — примеры из условий и случайные тесты против простых решений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/12.binary-tree-general
import { assert, fuzz, randInt, random, TreeNode, toTree, fromTree } from '../_shared.ts';

// --- шаблоны: обходы ---
function inorder(root: TreeNode | null, out: number[] = []): number[] {
  if (!root) return out;
  inorder(root.left, out);                        // левое поддерево
  out.push(root.val);                             // корень
  inorder(root.right, out);                       // правое поддерево
  return out;
}

function preorderIterative(root: TreeNode | null): number[] {
  const out: number[] = [];
  const stack = root ? [root] : [];
  while (stack.length) {
    const node = stack.pop()!;
    out.push(node.val);
    if (node.right) stack.push(node.right);       // правый кладём первым — снимется вторым
    if (node.left) stack.push(node.left);
  }
  return out;
}

// --- 104. Maximum Depth of Binary Tree ---
function maxDepth(root: TreeNode | null): number {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// --- 100. Same Tree ---
function isSameTree(p: TreeNode | null, q: TreeNode | null): boolean {
  if (!p || !q) return p === q;                   // оба пусты — равны, один пуст — нет
  return p.val === q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
}

// --- 226. Invert Binary Tree ---
function invertTree(root: TreeNode | null): TreeNode | null {
  if (!root) return null;
  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];
  return root;
}

// --- 101. Symmetric Tree ---
function isSymmetric(root: TreeNode | null): boolean {
  const mirror = (a: TreeNode | null, b: TreeNode | null): boolean => {
    if (!a || !b) return a === b;
    return a.val === b.val && mirror(a.left, b.right) && mirror(a.right, b.left);
  };
  return mirror(root?.left ?? null, root?.right ?? null);
}

// --- 105. Construct Binary Tree from Preorder and Inorder Traversal ---
function buildTree(preorder: number[], inorder: number[]): TreeNode | null {
  const index = new Map(inorder.map((v, i) => [v, i]));   // значение → позиция в inorder
  let next = 0;                                           // следующий корень в preorder
  const build = (lo: number, hi: number): TreeNode | null => {
    if (lo > hi) return null;
    const val = preorder[next++];
    const mid = index.get(val)!;
    const node = new TreeNode(val);
    node.left = build(lo, mid - 1);               // сначала левое — так идёт preorder
    node.right = build(mid + 1, hi);
    return node;
  };
  return build(0, inorder.length - 1);
}

// --- 106. Construct Binary Tree from Inorder and Postorder Traversal ---
function buildTreeFromPostorder(inorder: number[], postorder: number[]): TreeNode | null {
  const index = new Map(inorder.map((v, i) => [v, i]));
  let next = postorder.length - 1;                // корни идут с конца postorder
  const build = (lo: number, hi: number): TreeNode | null => {
    if (lo > hi) return null;
    const val = postorder[next--];
    const mid = index.get(val)!;
    const node = new TreeNode(val);
    node.right = build(mid + 1, hi);              // сначала правое — с конца postorder идёт оно
    node.left = build(lo, mid - 1);
    return node;
  };
  return build(0, inorder.length - 1);
}

// --- 117. Populating Next Right Pointers in Each Node II ---
class NextNode {
  val: number;
  left: NextNode | null;
  right: NextNode | null;
  next: NextNode | null;
  constructor(val?: number, left?: NextNode | null, right?: NextNode | null, next?: NextNode | null) {
    this.val = val ?? 0;
    this.left = left ?? null;
    this.right = right ?? null;
    this.next = next ?? null;
  }
}

function connect(root: NextNode | null): NextNode | null {
  let level = root;                               // идём по уровню через уже проставленные next
  while (level) {
    const dummy = new NextNode();                 // начало следующего уровня
    let tail = dummy;
    for (let node: NextNode | null = level; node; node = node.next) {
      if (node.left) tail = tail.next = node.left;
      if (node.right) tail = tail.next = node.right;
    }
    level = dummy.next;
  }
  return root;
}

// --- 114. Flatten Binary Tree to Linked List ---
function flatten(root: TreeNode | null): void {
  for (let node = root; node; node = node.right) {
    if (!node.left) continue;
    let rightmost = node.left;                    // самый правый в левом поддереве
    while (rightmost.right) rightmost = rightmost.right;
    rightmost.right = node.right;                 // прицепить правое поддерево к нему
    node.right = node.left;
    node.left = null;
  }
}

// --- 112. Path Sum ---
function hasPathSum(root: TreeNode | null, targetSum: number): boolean {
  if (!root) return false;
  if (!root.left && !root.right) return root.val === targetSum;   // только лист
  const rest = targetSum - root.val;
  return hasPathSum(root.left, rest) || hasPathSum(root.right, rest);
}

// --- 129. Sum Root to Leaf Numbers ---
function sumNumbers(root: TreeNode | null): number {
  const dfs = (node: TreeNode | null, prefix: number): number => {
    if (!node) return 0;
    const value = prefix * 10 + node.val;
    if (!node.left && !node.right) return value;
    return dfs(node.left, value) + dfs(node.right, value);
  };
  return dfs(root, 0);
}

// --- 124. Binary Tree Maximum Path Sum ---
function maxPathSum(root: TreeNode | null): number {
  let best = -Infinity;
  // возвращает лучший путь, идущий вниз от node; ответ — путь через node с двумя ветвями
  const down = (node: TreeNode | null): number => {
    if (!node) return 0;
    const left = Math.max(0, down(node.left));    // отрицательную ветвь не берём
    const right = Math.max(0, down(node.right));
    best = Math.max(best, node.val + left + right);
    return node.val + Math.max(left, right);
  };
  down(root);
  return best;
}

// --- 173. Binary Search Tree Iterator ---
class BSTIterator {
  private stack: TreeNode[] = [];

  constructor(root: TreeNode | null) {
    this.pushLeft(root);
  }
  private pushLeft(node: TreeNode | null): void {
    for (; node; node = node.left) this.stack.push(node);
  }
  next(): number {
    const node = this.stack.pop()!;
    this.pushLeft(node.right);
    return node.val;
  }
  hasNext(): boolean {
    return this.stack.length > 0;
  }
}

// --- 222. Count Complete Tree Nodes ---
function countNodes(root: TreeNode | null): number {
  if (!root) return 0;
  let leftHeight = 0;
  let rightHeight = 0;
  for (let n: TreeNode | null = root; n; n = n.left) leftHeight++;
  for (let n: TreeNode | null = root; n; n = n.right) rightHeight++;
  if (leftHeight === rightHeight) return 2 ** leftHeight - 1;    // совершенное дерево
  return 1 + countNodes(root.left) + countNodes(root.right);
}

// --- 236. Lowest Common Ancestor of a Binary Tree ---
function lowestCommonAncestor(root: TreeNode | null, p: TreeNode, q: TreeNode): TreeNode | null {
  if (!root || root === p || root === q) return root;
  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);
  if (left && right) return root;                 // p и q по разные стороны
  return left ?? right;
}

// ===== проверки =====
// случайное дерево с уникальными значениями
const randTree = (n: number, lo = 1): TreeNode | null => {
  const vals = Array.from({ length: n }, (_, i) => lo + i).sort(() => random() - 0.5);
  let root: TreeNode | null = null;
  for (const v of vals) {
    const node = new TreeNode(v);
    if (!root) { root = node; continue; }
    let cur = root;
    for (;;) {
      const goLeft = random() < 0.5;
      const child = goLeft ? cur.left : cur.right;
      if (!child) { if (goLeft) cur.left = node; else cur.right = node; break; }
      cur = child;
    }
  }
  return root;
};
const nodesOf = (r: TreeNode | null): TreeNode[] => (r ? [r, ...nodesOf(r.left), ...nodesOf(r.right)] : []);
const preorder = (r: TreeNode | null): number[] => (r ? [r.val, ...preorder(r.left), ...preorder(r.right)] : []);
const postorder = (r: TreeNode | null): number[] => (r ? [...postorder(r.left), ...postorder(r.right), r.val] : []);

fuzz(300, () => randTree(randInt(0, 12)), (t) => assert.deepEqual(preorderIterative(t), preorder(t)));
assert.deepEqual(inorder(toTree([1, null, 2, 3])), [1, 3, 2]);

// 104
assert.equal(maxDepth(toTree([3, 9, 20, null, null, 15, 7])), 3);
assert.equal(maxDepth(toTree([1, null, 2])), 2);
assert.equal(maxDepth(null), 0);

// 100
assert.equal(isSameTree(toTree([1, 2, 3]), toTree([1, 2, 3])), true);
assert.equal(isSameTree(toTree([1, 2]), toTree([1, null, 2])), false);
fuzz(300, () => [toTree([1, null, 2]), randTree(randInt(0, 4))] as const, ([a, b]) => {
  assert.equal(isSameTree(a, b), JSON.stringify(fromTree(a)) === JSON.stringify(fromTree(b)));
});

// 226
assert.deepEqual(fromTree(invertTree(toTree([4, 2, 7, 1, 3, 6, 9]))), [4, 7, 2, 9, 6, 3, 1]);
fuzz(300, () => randTree(randInt(0, 10)), (t) => {
  const before = inorder(t);
  assert.deepEqual(inorder(invertTree(t)), before.reverse());                                         // зеркало — обратный inorder
});

// 101
assert.equal(isSymmetric(toTree([1, 2, 2, 3, 4, 4, 3])), true);
assert.equal(isSymmetric(toTree([1, 2, 2, null, 3, null, 3])), false);
fuzz(300, () => randTree(randInt(0, 7)), (t) => {
  const copy = toTree(fromTree(t));
  const mirrored = invertTree(toTree(fromTree(t)));
  assert.equal(isSymmetric(t), isSameTree(copy, mirrored));
});

// 105, 106
assert.deepEqual(fromTree(buildTree([3, 9, 20, 15, 7], [9, 3, 15, 20, 7])), [3, 9, 20, null, null, 15, 7]);
assert.deepEqual(fromTree(buildTreeFromPostorder([9, 3, 15, 20, 7], [9, 15, 7, 20, 3])), [3, 9, 20, null, null, 15, 7]);
fuzz(500, () => randTree(randInt(0, 12)), (t) => {
  assert.deepEqual(fromTree(buildTree(preorder(t), inorder(t))), fromTree(t));
  assert.deepEqual(fromTree(buildTreeFromPostorder(inorder(t), postorder(t))), fromTree(t));
});

// 117
fuzz(300, () => randTree(randInt(0, 12)), (t) => {
  const toNext = (n: TreeNode | null): NextNode | null => (n ? new NextNode(n.val, toNext(n.left), toNext(n.right)) : null);
  const root = connect(toNext(t));
  // эталон: уровни обходом в ширину
  const levels: number[][] = [];
  const q: [NextNode, number][] = root ? [[root, 0]] : [];
  while (q.length) { const [n, d] = q.shift()!; (levels[d] ??= []).push(n.val); if (n.left) q.push([n.left, d + 1]); if (n.right) q.push([n.right, d + 1]); }
  const viaNext: number[][] = [];
  for (let first: NextNode | null = root, d = 0; first; d++) {
    const row: number[] = [];
    let nextFirst: NextNode | null = null;
    for (let n: NextNode | null = first; n; n = n.next) { row.push(n.val); nextFirst ??= n.left ?? n.right; }
    viaNext.push(row);
    first = nextFirst;
  }
  assert.deepEqual(viaNext.flat(), levels.flat());
});

// 114
fuzz(300, () => randTree(randInt(0, 12)), (t) => {
  const expected = preorder(t);
  flatten(t);
  const got: number[] = [];
  for (let n = t; n; n = n.right) { assert.equal(n.left, null); got.push(n.val); }
  assert.deepEqual(got, expected);
});

// 112, 129
assert.equal(hasPathSum(toTree([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]), 22), true);
assert.equal(hasPathSum(toTree([1, 2, 3]), 5), false);
assert.equal(hasPathSum(toTree([1, 2]), 1), false);                                                   // 1 — не лист
assert.equal(hasPathSum(null, 0), false);
assert.equal(sumNumbers(toTree([1, 2, 3])), 25);
assert.equal(sumNumbers(toTree([4, 9, 0, 5, 1])), 1026);
const paths = (r: TreeNode | null): number[][] => (!r ? [] : !r.left && !r.right ? [[r.val]] : [...paths(r.left), ...paths(r.right)].map((p) => [r.val, ...p]));
fuzz(500, () => { const t = randTree(randInt(1, 9)); nodesOf(t).forEach((n) => { n.val = n.val % 10; }); return t; }, (t) => {
  const ps = paths(t);
  assert.equal(sumNumbers(t), ps.reduce((s, p) => s + Number(p.join('')), 0));
  const target = randInt(0, 30);
  assert.equal(hasPathSum(t, target), ps.some((p) => p.reduce((a, b) => a + b, 0) === target));
});

// 124
assert.equal(maxPathSum(toTree([1, 2, 3])), 6);
assert.equal(maxPathSum(toTree([-10, 9, 20, null, null, 15, 7])), 42);
assert.equal(maxPathSum(toTree([-3])), -3);
fuzz(500, () => { const t = randTree(randInt(1, 8)); nodesOf(t).forEach((n) => { n.val = randInt(-5, 5); }); return t; }, (t) => {
  // перебор: путь между любыми двумя узлами через их общего предка
  const all = nodesOf(t);
  const parent = new Map<TreeNode, TreeNode>();
  for (const n of all) { if (n.left) parent.set(n.left, n); if (n.right) parent.set(n.right, n); }
  const up = (n: TreeNode) => { const chain = [n]; while (parent.has(chain.at(-1)!)) chain.push(parent.get(chain.at(-1)!)!); return chain; };
  let best = -Infinity;
  for (const a of all) for (const b of all) {
    const ua = up(a), ub = up(b);
    const lca = ua.find((x) => ub.includes(x))!;
    const sum = ua.slice(0, ua.indexOf(lca) + 1).reduce((s, x) => s + x.val, 0) + ub.slice(0, ub.indexOf(lca)).reduce((s, x) => s + x.val, 0);
    best = Math.max(best, sum);
  }
  assert.equal(maxPathSum(t), best);
});

// 173 (на BST)
const bst = toTree([7, 3, 15, null, null, 9, 20]);
const it = new BSTIterator(bst);
const seq: number[] = [];
while (it.hasNext()) seq.push(it.next());
assert.deepEqual(seq, [3, 7, 9, 15, 20]);
fuzz(300, () => randTree(randInt(0, 12)), (t) => {
  const iter = new BSTIterator(t), out: number[] = [];
  while (iter.hasNext()) out.push(iter.next());
  assert.deepEqual(out, inorder(t));
});

// 222
assert.equal(countNodes(toTree([1, 2, 3, 4, 5, 6])), 6);
assert.equal(countNodes(null), 0);
for (let n = 0; n <= 200; n++) assert.equal(countNodes(toTree(Array.from({ length: n }, (_, i) => i + 1))), n);

// 236
const lcaTree = toTree([3, 5, 1, 6, 2, 0, 8, null, null, 7, 4]);
const find = (r: TreeNode | null, v: number): TreeNode => nodesOf(r).find((n) => n.val === v)!;
assert.equal(lowestCommonAncestor(lcaTree, find(lcaTree, 5), find(lcaTree, 1))!.val, 3);
assert.equal(lowestCommonAncestor(lcaTree, find(lcaTree, 5), find(lcaTree, 4))!.val, 5);           // узел — предок самого себя
fuzz(500, () => randTree(randInt(1, 12)), (t) => {
  const all = nodesOf(t);
  const p = all[randInt(0, all.length - 1)], q = all[randInt(0, all.length - 1)];
  const ancestors = (target: TreeNode): TreeNode[] => { const path: TreeNode[] = []; const go = (n: TreeNode | null): boolean => !!n && (n === target || go(n.left) || go(n.right)) && (path.push(n), true); go(t); return path; };
  const ap = ancestors(p), aq = ancestors(q);
  assert.equal(lowestCommonAncestor(t, p, q), ap.find((x) => aq.includes(x)));
});

console.log('binary tree ok');
