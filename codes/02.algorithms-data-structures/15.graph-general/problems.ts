// Проверки к 2.15: обход графа в глубину, заливка, копирование, взвешенный граф отношений и
// топологическая сортировка — примеры из условий и случайные тесты против простых решений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/15.graph-general
import { assert, fuzz, randInt, random } from '../_shared.ts';

// --- шаблон: список смежности и обход в глубину ---
function buildGraph(n: number, edges: [number, number][]): number[][] {
  const graph: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    graph[a].push(b);
    graph[b].push(a);                             // неориентированный: ребро в обе стороны
  }
  return graph;
}

function countComponents(graph: number[][]): number {
  const seen = new Array(graph.length).fill(false);
  const dfs = (v: number): void => {
    seen[v] = true;
    for (const u of graph[v]) if (!seen[u]) dfs(u);
  };
  let components = 0;
  for (let v = 0; v < graph.length; v++) {
    if (!seen[v]) {
      components++;
      dfs(v);
    }
  }
  return components;
}

// --- 200. Number of Islands ---
function numIslands(grid: string[][]): number {
  const m = grid.length;
  const n = grid[0].length;
  const sink = (r: number, c: number): void => {
    const stack: [number, number][] = [[r, c]];
    grid[r][c] = '0';
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx >= 0 && nx < m && ny >= 0 && ny < n && grid[nx][ny] === '1') {
          grid[nx][ny] = '0';                     // отметить при добавлении, а не при снятии
          stack.push([nx, ny]);
        }
      }
    }
  };
  let islands = 0;
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === '1') {
        islands++;
        sink(r, c);
      }
    }
  }
  return islands;
}

// --- 130. Surrounded Regions ---
function solve(board: string[][]): void {
  const m = board.length;
  const n = board[0].length;
  const keep = (r: number, c: number): void => {
    if (r < 0 || r >= m || c < 0 || c >= n || board[r][c] !== 'O') return;
    board[r][c] = '#';                            // связано с краем — не захватывается
    keep(r + 1, c);
    keep(r - 1, c);
    keep(r, c + 1);
    keep(r, c - 1);
  };
  for (let r = 0; r < m; r++) {
    keep(r, 0);
    keep(r, n - 1);
  }
  for (let c = 0; c < n; c++) {
    keep(0, c);
    keep(m - 1, c);
  }
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) board[r][c] = board[r][c] === '#' ? 'O' : 'X';
  }
}

// --- 133. Clone Graph ---
class GraphNode {
  val: number;
  neighbors: GraphNode[];
  constructor(val?: number, neighbors?: GraphNode[]) {
    this.val = val ?? 0;
    this.neighbors = neighbors ?? [];
  }
}

function cloneGraph(node: GraphNode | null): GraphNode | null {
  if (!node) return null;
  const copies = new Map<GraphNode, GraphNode>();
  const clone = (v: GraphNode): GraphNode => {
    const existing = copies.get(v);
    if (existing) return existing;
    const copy = new GraphNode(v.val);
    copies.set(v, copy);                          // записать до обхода соседей — циклы
    copy.neighbors = v.neighbors.map(clone);
    return copy;
  };
  return clone(node);
}

// --- 399. Evaluate Division ---
function calcEquation(equations: string[][], values: number[], queries: string[][]): number[] {
  const graph = new Map<string, [string, number][]>();
  const add = (a: string, b: string, w: number) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a)!.push([b, w]);
  };
  equations.forEach(([a, b], i) => {
    add(a, b, values[i]);                         // a / b = w
    add(b, a, 1 / values[i]);                     // b / a = 1 / w
  });
  const query = (from: string, to: string): number => {
    if (!graph.has(from) || !graph.has(to)) return -1;
    const seen = new Set([from]);
    const stack: [string, number][] = [[from, 1]];
    while (stack.length) {
      const [v, product] = stack.pop()!;
      if (v === to) return product;
      for (const [u, w] of graph.get(v)!) {
        if (!seen.has(u)) {
          seen.add(u);
          stack.push([u, product * w]);           // произведение весов по пути
        }
      }
    }
    return -1;
  };
  return queries.map(([a, b]) => query(a, b));
}

// --- 207. Course Schedule ---
function canFinish(numCourses: number, prerequisites: number[][]): boolean {
  const graph: number[][] = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    graph[pre].push(course);
    indegree[course]++;
  }
  const queue = indegree.flatMap((d, v) => (d === 0 ? [v] : []));
  let taken = 0;
  for (let head = 0; head < queue.length; head++) {
    taken++;
    for (const next of graph[queue[head]]) if (--indegree[next] === 0) queue.push(next);
  }
  return taken === numCourses;                    // остались курсы — есть цикл
}

// --- 210. Course Schedule II ---
function findOrder(numCourses: number, prerequisites: number[][]): number[] {
  const graph: number[][] = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    graph[pre].push(course);
    indegree[course]++;
  }
  const order = indegree.flatMap((d, v) => (d === 0 ? [v] : []));
  for (let head = 0; head < order.length; head++) {
    for (const next of graph[order[head]]) if (--indegree[next] === 0) order.push(next);
  }
  return order.length === numCourses ? order : [];
}

// ===== проверки =====
assert.equal(countComponents(buildGraph(5, [[0, 1], [1, 2], [3, 4]])), 2);
assert.equal(countComponents(buildGraph(4, [])), 4);

// 200
const g1 = [['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']];
assert.equal(numIslands(g1.map((r) => [...r])), 3);
fuzz(1000, () => { const m = randInt(1, 6), n = randInt(1, 6); return Array.from({ length: m }, () => Array.from({ length: n }, () => (random() < 0.5 ? '1' : '0'))); }, (grid) => {
  // эталон: компоненты через граф клеток
  const m = grid.length, n = grid[0].length, id = (r: number, c: number) => r * n + c;
  const edges: [number, number][] = [];
  const land: number[] = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) if (grid[r][c] === '1') {
    land.push(id(r, c));
    if (r + 1 < m && grid[r + 1][c] === '1') edges.push([id(r, c), id(r + 1, c)]);
    if (c + 1 < n && grid[r][c + 1] === '1') edges.push([id(r, c), id(r, c + 1)]);
  }
  const all = countComponents(buildGraph(m * n, edges));
  assert.equal(numIslands(grid.map((r) => [...r])), all - (m * n - land.length));               // минус клетки воды
});

// 130
const b1 = [['X', 'X', 'X', 'X'], ['X', 'O', 'O', 'X'], ['X', 'X', 'O', 'X'], ['X', 'O', 'X', 'X']];
solve(b1);
assert.deepEqual(b1, [['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X'], ['X', 'O', 'X', 'X']]);
fuzz(1000, () => { const m = randInt(1, 6), n = randInt(1, 6); return Array.from({ length: m }, () => Array.from({ length: n }, () => (random() < 0.5 ? 'O' : 'X'))); }, (board) => {
  const m = board.length, n = board[0].length;
  // эталон: клетка O остаётся, если из неё по O можно дойти до края (поиск в ширину от каждой)
  const reachesEdge = (r0: number, c0: number) => {
    const seen = new Set([`${r0},${c0}`]); const q = [[r0, c0]];
    for (let h = 0; h < q.length; h++) {
      const [r, c] = q[h];
      if (r === 0 || c === 0 || r === m - 1 || c === n - 1) return true;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) if (board[nr]?.[nc] === 'O' && !seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); q.push([nr, nc]); }
    }
    return false;
  };
  const expected = board.map((row, r) => row.map((v, c) => (v === 'O' && reachesEdge(r, c) ? 'O' : 'X')));
  const copy = board.map((r) => [...r]);
  solve(copy);
  assert.deepEqual(copy, expected);
});

// 133
fuzz(300, () => { const n = randInt(1, 7); const e = new Set<string>(); for (let i = 0; i < n * 2; i++) { const a = randInt(1, n), b = randInt(1, n); if (a !== b) e.add([Math.min(a, b), Math.max(a, b)].join(',')); } return { n, edges: [...e].map((s) => s.split(',').map(Number)) }; }, ({ n, edges }) => {
  const nodes = Array.from({ length: n }, (_, i) => new GraphNode(i + 1));
  for (const [a, b] of edges) { nodes[a - 1].neighbors.push(nodes[b - 1]); nodes[b - 1].neighbors.push(nodes[a - 1]); }
  const copy = cloneGraph(nodes[0])!;
  const seen = new Map<number, GraphNode>(); const stack = [copy];
  while (stack.length) { const v = stack.pop()!; if (seen.has(v.val)) continue; seen.set(v.val, v); assert.ok(!nodes.includes(v)); stack.push(...v.neighbors); }
  for (const [val, v] of seen) assert.deepEqual(v.neighbors.map((u) => u.val), nodes[val - 1].neighbors.map((u) => u.val));
  for (const [, v] of seen) for (const u of v.neighbors) assert.equal(seen.get(u.val), u);         // одна копия на узел
});

// 399
assert.deepEqual(calcEquation([['a', 'b'], ['b', 'c']], [2, 3], [['a', 'c'], ['b', 'a'], ['a', 'e'], ['a', 'a'], ['x', 'x']]), [6, 0.5, -1, 1, -1]);
fuzz(300, () => { const vars = ['a', 'b', 'c', 'd', 'e']; const val = Object.fromEntries(vars.map((v) => [v, randInt(1, 9)])); const eq = Array.from({ length: randInt(1, 4) }, () => [vars[randInt(0, 4)], vars[randInt(0, 4)]]); return { val, eq }; }, ({ val, eq }) => {
  const res = calcEquation(eq, eq.map(([a, b]) => val[a] / val[b]), [['a', 'e'], ['b', 'c']]);
  const idx = (v: string) => 'abcde'.indexOf(v);
  const g = buildGraph(5, eq.map(([p, q]) => [idx(p), idx(q)] as [number, number]));
  const linked = (x: string, y: string) => {
    const seen = new Set([idx(x)]);
    for (const st = [idx(x)]; st.length; ) for (const u of g[st.pop()!]) if (!seen.has(u)) { seen.add(u); st.push(u); }
    return seen.has(idx(y));
  };
  const inEq = (x: string) => eq.some(([p, q]) => p === x || q === x);
  [['a', 'e'], ['b', 'c']].forEach(([x, y], i) => {
    if (inEq(x) && inEq(y) && linked(x, y)) assert.ok(Math.abs(res[i] - val[x] / val[y]) < 1e-9);
    else assert.equal(res[i], -1);
  });
});

// 207, 210
assert.equal(canFinish(2, [[1, 0]]), true);
assert.equal(canFinish(2, [[1, 0], [0, 1]]), false);
assert.deepEqual(findOrder(2, [[1, 0]]), [0, 1]);
assert.deepEqual(findOrder(1, []), [0]);
assert.deepEqual(findOrder(2, [[0, 1], [1, 0]]), []);
fuzz(1000, () => { const n = randInt(1, 7); return { n, pre: Array.from({ length: randInt(0, 8) }, () => [randInt(0, n - 1), randInt(0, n - 1)]) }; }, ({ n, pre }) => {
  // есть ли цикл: перебор — DFS с цветами
  const g: number[][] = Array.from({ length: n }, () => []);
  for (const [c, p] of pre) g[p].push(c);
  const color = new Array(n).fill(0);
  const cyc = (v: number): boolean => { color[v] = 1; for (const u of g[v]) if (color[u] === 1 || (color[u] === 0 && cyc(u))) return true; color[v] = 2; return false; };
  const hasCycle = Array.from({ length: n }, (_, v) => v).some((v) => color[v] === 0 && cyc(v));
  assert.equal(canFinish(n, pre), !hasCycle);
  const order = findOrder(n, pre);
  if (hasCycle) assert.deepEqual(order, []);
  else {
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
    for (const [c, p] of pre) assert.ok(order.indexOf(p) < order.indexOf(c));
  }
});

console.log('graph ok');
