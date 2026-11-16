// Проверки к 2.16: кратчайший путь обходом в ширину в невзвешенном графе — на поле, в мутациях генов и
// в лестнице слов; примеры из условий и случайные тесты против перебора путей.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/16.graph-bfs
import { assert, fuzz, randInt, randString } from '../_shared.ts';

// --- шаблон: кратчайшее расстояние от вершины ---
function bfsDistances(graph: number[][], start: number): number[] {
  const dist = new Array(graph.length).fill(-1);
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    for (const u of graph[v]) {
      if (dist[u] === -1) {                       // первый раз нашли — это и есть кратчайший путь
        dist[u] = dist[v] + 1;
        queue.push(u);
      }
    }
  }
  return dist;
}

// --- 909. Snakes and Ladders ---
function snakesAndLadders(board: number[][]): number {
  const n = board.length;
  const cell = (k: number): number => {           // номер клетки 1..n² → значение на доске
    const row = Math.floor((k - 1) / n);
    const col = (k - 1) % n;
    const r = n - 1 - row;                        // ряды снизу вверх
    const c = row % 2 === 0 ? col : n - 1 - col;  // змейкой: чётные слева направо
    return board[r][c];
  };
  const target = n * n;
  const dist = new Map<number, number>([[1, 0]]);
  const queue = [1];
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head];
    if (k === target) return dist.get(k)!;
    for (let step = 1; step <= 6 && k + step <= target; step++) {
      let next = k + step;
      if (cell(next) !== -1) next = cell(next);   // лестница или змея — переход сразу
      if (!dist.has(next)) {
        dist.set(next, dist.get(k)! + 1);
        queue.push(next);
      }
    }
  }
  return -1;
}

// --- 433. Minimum Genetic Mutation ---
function minMutation(startGene: string, endGene: string, bank: string[]): number {
  const allowed = new Set(bank);
  if (!allowed.has(endGene)) return -1;
  const seen = new Set([startGene]);
  let level = [startGene];
  for (let steps = 0; level.length; steps++) {
    const next: string[] = [];
    for (const gene of level) {
      if (gene === endGene) return steps;
      for (let i = 0; i < gene.length; i++) {
        for (const c of 'ACGT') {
          const mutated = gene.slice(0, i) + c + gene.slice(i + 1);
          if (allowed.has(mutated) && !seen.has(mutated)) {
            seen.add(mutated);
            next.push(mutated);
          }
        }
      }
    }
    level = next;
  }
  return -1;
}

// --- 127. Word Ladder ---
function ladderLength(beginWord: string, endWord: string, wordList: string[]): number {
  const words = new Set(wordList);
  if (!words.has(endWord)) return 0;
  let level = [beginWord];
  words.delete(beginWord);
  for (let length = 1; level.length; length++) {
    const next: string[] = [];
    for (const word of level) {
      if (word === endWord) return length;
      for (let i = 0; i < word.length; i++) {
        for (let code = 97; code <= 122; code++) {
          const candidate = word.slice(0, i) + String.fromCharCode(code) + word.slice(i + 1);
          if (words.has(candidate)) {
            words.delete(candidate);              // удалить — значит отметить посещённым
            next.push(candidate);
          }
        }
      }
    }
    level = next;
  }
  return 0;
}

// ===== проверки =====
assert.deepEqual(bfsDistances([[1, 2], [0, 3], [0, 3], [1, 2], []], 0), [0, 1, 1, 2, -1]);

// 909
assert.equal(snakesAndLadders([
  [-1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1],
  [-1, 35, -1, -1, 13, -1],
  [-1, -1, -1, -1, -1, -1],
  [-1, 15, -1, -1, -1, -1],
]), 4);
assert.equal(snakesAndLadders([[-1, -1], [-1, 3]]), 1);
assert.equal(snakesAndLadders([[-1, -1, -1], [-1, 9, 8], [-1, 8, 9]]), 1);
// эталон: Беллман — Форд по числу бросков на тех же правилах
fuzz(300, () => {
  const n = randInt(2, 5);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => (randInt(0, 5) === 0 ? randInt(1, n * n) : -1)));
}, (board) => {
  const n = board.length, target = n * n;
  board[n - 1][0] = -1;                                                                              // в клетке 1 ничего нет
  const cell = (k: number) => { const row = Math.floor((k - 1) / n), col = (k - 1) % n; return board[n - 1 - row][row % 2 ? n - 1 - col : col]; };
  const best = new Array(target + 1).fill(Infinity);
  best[1] = 0;
  for (let round = 0; round < target; round++) for (let k = 1; k < target; k++) if (best[k] < Infinity) for (let s = 1; s <= 6 && k + s <= target; s++) { const nx = cell(k + s) === -1 ? k + s : cell(k + s); best[nx] = Math.min(best[nx], best[k] + 1); }
  assert.equal(snakesAndLadders(board), best[target] === Infinity ? -1 : best[target]);
});

// 433
assert.equal(minMutation('AACCGGTT', 'AACCGGTA', ['AACCGGTA']), 1);
assert.equal(minMutation('AACCGGTT', 'AAACGGTA', ['AACCGGTA', 'AACCGCTA', 'AAACGGTA']), 2);
assert.equal(minMutation('AAAAACCC', 'AACCCCCC', ['AAAACCCC', 'AAACCCCC', 'AACCCCCC']), 3);
assert.equal(minMutation('AACCGGTT', 'AACCGGTA', []), -1);

// 127
assert.equal(ladderLength('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']), 5);
assert.equal(ladderLength('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log']), 0);
fuzz(500, () => { const w = () => randString(3, 'abc'); return { begin: w(), end: w(), list: Array.from({ length: randInt(1, 10) }, w) }; }, ({ begin, end, list }) => {
  // эталон: BFS по явному графу слов
  const nodes = [...new Set([begin, ...list])];
  const diff1 = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length === 1;
  const g = nodes.map((a) => nodes.flatMap((b, j) => (diff1(a, b) && b !== begin ? [j] : [])));
  const d = bfsDistances(g, 0);
  const j = nodes.indexOf(end);
  const expected = list.includes(end) && j >= 0 && d[j] >= 0 ? d[j] + 1 : 0;
  assert.equal(ladderLength(begin, end, list), expected);
});

console.log('graph bfs ok');
