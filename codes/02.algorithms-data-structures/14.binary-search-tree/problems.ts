// Проверки к 2.14: свойство BST и симметричный обход — примеры из условий и случайные тесты против
// сортировки значений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/14.binary-search-tree
import { assert, fuzz, randArray, randInt, TreeNode, toTree } from '../_shared.ts';

// --- шаблоны: поиск и вставка ---
function searchBST(root: TreeNode | null, val: number): TreeNode | null {
  let node = root;
  while (node && node.val !== val) node = val < node.val ? node.left : node.right;
  return node;
}

function insertIntoBST(root: TreeNode | null, val: number): TreeNode {
  if (!root) return new TreeNode(val);
  if (val < root.val) root.left = insertIntoBST(root.left, val);
  else root.right = insertIntoBST(root.right, val);
  return root;
}

// --- 530. Minimum Absolute Difference in BST ---
function getMinimumDifference(root: TreeNode | null): number {
  let best = Infinity;
  let prev: number | null = null;
  const inorder = (node: TreeNode | null): void => {
    if (!node) return;
    inorder(node.left);
    if (prev !== null) best = Math.min(best, node.val - prev);   // соседи в отсортированном порядке
    prev = node.val;
    inorder(node.right);
  };
  inorder(root);
  return best;
}

// --- 230. Kth Smallest Element in a BST ---
function kthSmallest(root: TreeNode | null, k: number): number {
  const stack: TreeNode[] = [];
  let node = root;
  for (;;) {
    while (node) {
      stack.push(node);
      node = node.left;
    }
    node = stack.pop()!;
    if (--k === 0) return node.val;               // k-й в симметричном обходе
    node = node.right;
  }
}

// --- 98. Validate Binary Search Tree ---
function isValidBST(root: TreeNode | null, low = -Infinity, high = Infinity): boolean {
  if (!root) return true;
  if (root.val <= low || root.val >= high) return false;      // границы от всех предков
  return isValidBST(root.left, low, root.val) && isValidBST(root.right, root.val, high);
}

// ===== проверки =====
const buildBST = (vals: number[]) => vals.reduce<TreeNode | null>((r, v) => insertIntoBST(r, v), null);
const inorderVals = (r: TreeNode | null): number[] => (r ? [...inorderVals(r.left), r.val, ...inorderVals(r.right)] : []);
const uniq = () => [...new Set(randArray(randInt(1, 15), 0, 50))];

fuzz(500, uniq, (vals) => {
  const t = buildBST(vals);
  assert.deepEqual(inorderVals(t), [...vals].sort((a, b) => a - b));                               // BST: inorder отсортирован
  for (const v of vals) assert.equal(searchBST(t, v)!.val, v);
  assert.equal(searchBST(t, 51), null);
});

// 530
assert.equal(getMinimumDifference(toTree([4, 2, 6, 1, 3])), 1);
assert.equal(getMinimumDifference(toTree([1, 0, 48, null, null, 12, 49])), 1);
fuzz(500, () => [...new Set(randArray(randInt(2, 15), 0, 100))], (vals) => {
  if (vals.length < 2) return;
  const s = [...vals].sort((a, b) => a - b);
  assert.equal(getMinimumDifference(buildBST(vals)), Math.min(...s.slice(1).map((x, i) => x - s[i])));
});

// 230
assert.equal(kthSmallest(toTree([3, 1, 4, null, 2]), 1), 1);
assert.equal(kthSmallest(toTree([5, 3, 6, 2, 4, null, null, 1]), 3), 3);
fuzz(500, uniq, (vals) => {
  const s = [...vals].sort((a, b) => a - b);
  const k = randInt(1, s.length);
  assert.equal(kthSmallest(buildBST(vals), k), s[k - 1]);
});

// 98
assert.equal(isValidBST(toTree([2, 1, 3])), true);
assert.equal(isValidBST(toTree([5, 1, 4, null, null, 3, 6])), false);
assert.equal(isValidBST(toTree([5, 4, 6, null, null, 3, 7])), false);                             // 3 правее 5 — проверка только с родителем пропустит
assert.equal(isValidBST(toTree([2, 2, 2])), false);                                                 // равные значения запрещены
assert.equal(isValidBST(toTree([-2147483648, null, 2147483647])), true);
fuzz(1000, () => toTree(randArray(randInt(1, 10), 0, 9).map((v) => (randInt(0, 4) === 0 ? null : v))), (t) => {
  const vals = inorderVals(t);
  assert.equal(isValidBST(t), vals.every((v, i) => i === 0 || v > vals[i - 1]));
});

console.log('bst ok');
