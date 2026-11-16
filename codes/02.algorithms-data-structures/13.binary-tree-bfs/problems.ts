// Проверки к 2.13: обход дерева в ширину по уровням — примеры из условий и случайные тесты против
// группировки узлов по глубине, найденной обходом в глубину.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/13.binary-tree-bfs
import { assert, fuzz, randInt, random, TreeNode, toTree } from '../_shared.ts';

// --- шаблон: уровни дерева ---
function levels(root: TreeNode | null): number[][] {
  const result: number[][] = [];
  let level = root ? [root] : [];
  while (level.length) {
    result.push(level.map((n) => n.val));
    const next: TreeNode[] = [];
    for (const n of level) {
      if (n.left) next.push(n.left);
      if (n.right) next.push(n.right);
    }
    level = next;
  }
  return result;
}

// --- 199. Binary Tree Right Side View ---
function rightSideView(root: TreeNode | null): number[] {
  const result: number[] = [];
  let level = root ? [root] : [];
  while (level.length) {
    result.push(level.at(-1)!.val);               // последний на уровне виден справа
    level = level.flatMap((n) => [n.left, n.right].filter((c): c is TreeNode => c !== null));
  }
  return result;
}

// --- 637. Average of Levels in Binary Tree ---
function averageOfLevels(root: TreeNode | null): number[] {
  const result: number[] = [];
  let level = root ? [root] : [];
  while (level.length) {
    result.push(level.reduce((sum, n) => sum + n.val, 0) / level.length);
    level = level.flatMap((n) => [n.left, n.right].filter((c): c is TreeNode => c !== null));
  }
  return result;
}

// --- 102. Binary Tree Level Order Traversal ---
function levelOrder(root: TreeNode | null): number[][] {
  const result: number[][] = [];
  const queue: TreeNode[] = root ? [root] : [];
  let head = 0;                                   // указатель вместо shift — O(1)
  while (head < queue.length) {
    const size = queue.length - head;             // столько узлов на текущем уровне
    const row: number[] = [];
    for (let i = 0; i < size; i++) {
      const node = queue[head++];
      row.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(row);
  }
  return result;
}

// --- 103. Binary Tree Zigzag Level Order Traversal ---
function zigzagLevelOrder(root: TreeNode | null): number[][] {
  return levelOrder(root).map((row, depth) => (depth % 2 ? row.reverse() : row));
}

// ===== проверки =====
const randTree = (n: number): TreeNode | null => {
  let root: TreeNode | null = null;
  for (let v = 1; v <= n; v++) {
    const node = new TreeNode(randInt(-9, 9));
    if (!root) { root = node; continue; }
    for (let cur = root; ;) {
      const goLeft = random() < 0.5;
      const child = goLeft ? cur.left : cur.right;
      if (!child) { if (goLeft) cur.left = node; else cur.right = node; break; }
      cur = child;
    }
  }
  return root;
};
// эталон: обход в глубину с номером уровня (слева направо)
const byDepth = (root: TreeNode | null): number[][] => {
  const rows: number[][] = [];
  const dfs = (n: TreeNode | null, d: number) => { if (!n) return; (rows[d] ??= []).push(n.val); dfs(n.left, d + 1); dfs(n.right, d + 1); };
  dfs(root, 0);
  return rows;
};

const example = toTree([3, 9, 20, null, null, 15, 7]);
assert.deepEqual(levels(example), [[3], [9, 20], [15, 7]]);
assert.deepEqual(levelOrder(example), [[3], [9, 20], [15, 7]]);
assert.deepEqual(zigzagLevelOrder(example), [[3], [20, 9], [15, 7]]);
assert.deepEqual(averageOfLevels(example), [3, 14.5, 11]);
assert.deepEqual(rightSideView(toTree([1, 2, 3, null, 5, null, 4])), [1, 3, 4]);
assert.deepEqual(rightSideView(toTree([1, 2, 3, 4])), [1, 3, 4]);                                  // левый узел виден, если правее никого
assert.deepEqual(levelOrder(null), []);

fuzz(500, () => randTree(randInt(0, 15)), (t) => {
  const rows = byDepth(t);
  assert.deepEqual(levels(t), rows);
  assert.deepEqual(levelOrder(t), rows);
  assert.deepEqual(rightSideView(t), rows.map((r) => r.at(-1)));
  assert.deepEqual(averageOfLevels(t), rows.map((r) => r.reduce((a, b) => a + b, 0) / r.length));
  assert.deepEqual(zigzagLevelOrder(t), rows.map((r, d) => (d % 2 ? [...r].reverse() : r)));
});

// shift() на очереди — O(n) на операцию: опустошение очереди растёт квадратично; указатель головы — O(1)
const filled = (n: number) => { const q: { i: number }[] = []; for (let i = 0; i < n; i++) q.push({ i }); return q; };
const drainShift = (n: number) => { const q = filled(n); const t = performance.now(); while (q.length) q.shift(); return performance.now() - t; };
const drainHead = (n: number) => { const q = filled(n); const t = performance.now(); let h = 0; while (h < q.length) h++; return performance.now() - t; };
drainShift(10_000);                                                                                // прогрев JIT
const best = (n: number) => Math.min(drainShift(n), drainShift(n));
const s40 = best(40_000), s80 = best(80_000);
assert.ok(s80 > s40 * 2.5, `shift: 40 тыс. — ${s40.toFixed(0)} мс, 80 тыс. — ${s80.toFixed(0)} мс`);   // вдвое больше — вчетверо дольше
assert.ok(s80 > drainHead(80_000) * 50);
assert.equal(levelOrder(toTree(Array.from({ length: 200_000 }, (_, i) => i))).length, 18);         // 200 тыс. узлов — 18 уровней

console.log('bfs ok');
