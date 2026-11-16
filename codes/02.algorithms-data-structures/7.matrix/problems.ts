// Проверки к 2.07: обход матрицы, направления, поворот и изменение на месте — примеры из условий
// и случайные тесты против простых решений с копией.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/7.matrix
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- шаблон: соседи клетки ---
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];         // вверх, вниз, влево, вправо

function neighbors(grid: number[][], r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) out.push([nr, nc]);
  }
  return out;
}

// --- 36. Valid Sudoku ---
function isValidSudoku(board: string[][]): boolean {
  const rows = Array.from({ length: 9 }, () => new Set<string>());
  const cols = Array.from({ length: 9 }, () => new Set<string>());
  const boxes = Array.from({ length: 9 }, () => new Set<string>());
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (v === '.') continue;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);   // номер квадрата 3 × 3
      if (rows[r].has(v) || cols[c].has(v) || boxes[b].has(v)) return false;
      rows[r].add(v);
      cols[c].add(v);
      boxes[b].add(v);
    }
  }
  return true;
}

// --- 54. Spiral Matrix ---
function spiralOrder(matrix: number[][]): number[] {
  const result: number[] = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) result.push(matrix[top][c]);
    top++;
    for (let r = top; r <= bottom; r++) result.push(matrix[r][right]);
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) result.push(matrix[bottom][c]);
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) result.push(matrix[r][left]);
      left++;
    }
  }
  return result;
}

// --- 48. Rotate Image ---
function rotate(matrix: number[][]): void {
  const n = matrix.length;
  for (let r = 0; r < n; r++) {               // транспонирование: отражение по диагонали
    for (let c = r + 1; c < n; c++) {
      [matrix[r][c], matrix[c][r]] = [matrix[c][r], matrix[r][c]];
    }
  }
  for (const row of matrix) row.reverse();     // отражение по вертикали
}

// --- 73. Set Matrix Zeroes ---
function setZeroes(matrix: number[][]): void {
  const m = matrix.length;
  const n = matrix[0].length;
  const firstRowZero = matrix[0].some((v) => v === 0);
  const firstColZero = matrix.some((row) => row[0] === 0);
  for (let r = 1; r < m; r++) {               // первая строка и столбец — флаги
    for (let c = 1; c < n; c++) {
      if (matrix[r][c] === 0) {
        matrix[r][0] = 0;
        matrix[0][c] = 0;
      }
    }
  }
  for (let r = 1; r < m; r++) {
    for (let c = 1; c < n; c++) {
      if (matrix[r][0] === 0 || matrix[0][c] === 0) matrix[r][c] = 0;
    }
  }
  if (firstRowZero) matrix[0].fill(0);
  if (firstColZero) for (const row of matrix) row[0] = 0;
}

// --- 289. Game of Life ---
function gameOfLife(board: number[][]): void {
  const m = board.length;
  const n = board[0].length;
  // бит 0 — текущее состояние, бит 1 — следующее
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      let alive = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < m && nc >= 0 && nc < n) alive += board[nr][nc] & 1;
        }
      }
      const live = board[r][c] & 1;
      if ((live && (alive === 2 || alive === 3)) || (!live && alive === 3)) board[r][c] |= 2;
    }
  }
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) board[r][c] >>= 1;
}

// ===== проверки =====
const grid = [[1, 2, 3], [4, 5, 6]];
assert.deepEqual(neighbors(grid, 0, 0), [[1, 0], [0, 1]]);
assert.deepEqual(neighbors(grid, 1, 1).length, 3);

// 36
const sudoku = [
  ['5', '3', '.', '.', '7', '.', '.', '.', '.'],
  ['6', '.', '.', '1', '9', '5', '.', '.', '.'],
  ['.', '9', '8', '.', '.', '.', '.', '6', '.'],
  ['8', '.', '.', '.', '6', '.', '.', '.', '3'],
  ['4', '.', '.', '8', '.', '3', '.', '.', '1'],
  ['7', '.', '.', '.', '2', '.', '.', '.', '6'],
  ['.', '6', '.', '.', '.', '.', '2', '8', '.'],
  ['.', '.', '.', '4', '1', '9', '.', '.', '5'],
  ['.', '.', '.', '.', '8', '.', '.', '7', '9'],
];
assert.equal(isValidSudoku(sudoku), true);
const bad = sudoku.map((row) => [...row]);
bad[0][0] = '8';                                                                                   // 8 дважды в первом столбце и квадрате
assert.equal(isValidSudoku(bad), false);
fuzz(1000, () => Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => (randInt(0, 6) === 0 ? String(randInt(1, 9)) : '.'))), (b) => {
  const units: string[][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(b[i], b.map((row) => row[i]));
    const box: string[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(b[Math.floor(i / 3) * 3 + r][(i % 3) * 3 + c]);
    units.push(box);
  }
  const ok = units.every((u) => { const d = u.filter((v) => v !== '.'); return new Set(d).size === d.length; });
  assert.equal(isValidSudoku(b), ok);
});

// 54
assert.deepEqual(spiralOrder([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), [1, 2, 3, 6, 9, 8, 7, 4, 5]);
assert.deepEqual(spiralOrder([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]), [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]);
assert.deepEqual(spiralOrder([[1], [2], [3]]), [1, 2, 3]);
assert.deepEqual(spiralOrder([[1, 2, 3]]), [1, 2, 3]);
fuzz(500, () => { const m = randInt(1, 6), n = randInt(1, 6); let k = 0; return Array.from({ length: m }, () => Array.from({ length: n }, () => k++)); }, (mat) => {
  const out = spiralOrder(mat);
  assert.deepEqual([...out].sort((a, b) => a - b), mat.flat());                                     // каждый элемент ровно один раз
  assert.deepEqual(out.slice(0, mat[0].length), mat[0]);
});

// 48
const img = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
rotate(img);
assert.deepEqual(img, [[7, 4, 1], [8, 5, 2], [9, 6, 3]]);
fuzz(500, () => { const n = randInt(1, 6); return Array.from({ length: n }, () => randArray(n, 0, 9)); }, (mat) => {
  const n = mat.length;
  const expected = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => mat[n - 1 - c][r]));
  const copy = mat.map((row) => [...row]);
  rotate(copy);
  assert.deepEqual(copy, expected);
});

// 73
const z = [[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]];
setZeroes(z);
assert.deepEqual(z, [[0, 0, 0, 0], [0, 4, 5, 0], [0, 3, 1, 0]]);
fuzz(1000, () => { const m = randInt(1, 5), n = randInt(1, 5); return Array.from({ length: m }, () => randArray(n, 0, 3)); }, (mat) => {
  const rows = new Set<number>(), cols = new Set<number>();
  mat.forEach((row, r) => row.forEach((v, c) => { if (v === 0) { rows.add(r); cols.add(c); } }));
  const expected = mat.map((row, r) => row.map((v, c) => (rows.has(r) || cols.has(c) ? 0 : v)));
  const copy = mat.map((row) => [...row]);
  setZeroes(copy);
  assert.deepEqual(copy, expected);
});

// 289
const life = [[0, 1, 0], [0, 0, 1], [1, 1, 1], [0, 0, 0]];
gameOfLife(life);
assert.deepEqual(life, [[0, 0, 0], [1, 0, 1], [0, 1, 1], [0, 1, 0]]);
fuzz(500, () => { const m = randInt(1, 6), n = randInt(1, 6); return Array.from({ length: m }, () => randArray(n, 0, 1)); }, (b) => {
  const next = b.map((row, r) => row.map((v, c) => {
    let alive = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && b[r + dr]?.[c + dc] === 1) alive++;
    return (v && (alive === 2 || alive === 3)) || (!v && alive === 3) ? 1 : 0;
  }));
  const copy = b.map((row) => [...row]);
  gameOfLife(copy);
  assert.deepEqual(copy, next);
});

console.log('matrix ok');
