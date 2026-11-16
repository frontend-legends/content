// Проверки к 2.18: перебор с возвратом — подмножества, сочетания, перестановки, суммы, ферзи, скобки
// и поиск слова; примеры из условий, известные количества и сравнение с перебором без отсечений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/18.backtracking
import { assert, fuzz, randInt, randString } from '../_shared.ts';

// --- шаблон: все подмножества ---
function subsets(nums: number[]): number[][] {
  const result: number[][] = [];
  const path: number[] = [];
  const backtrack = (start: number): void => {
    result.push([...path]);                       // копия: path ещё будет меняться
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);                         // выбрать
      backtrack(i + 1);                           // продолжить
      path.pop();                                 // отменить выбор
    }
  };
  backtrack(0);
  return result;
}

// --- 17. Letter Combinations of a Phone Number ---
function letterCombinations(digits: string): string[] {
  if (!digits) return [];
  const keys: Record<string, string> = {
    2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz',
  };
  const result: string[] = [];
  const backtrack = (i: number, prefix: string): void => {
    if (i === digits.length) {
      result.push(prefix);
      return;
    }
    for (const letter of keys[digits[i]]) backtrack(i + 1, prefix + letter);
  };
  backtrack(0, '');
  return result;
}

// --- 77. Combinations ---
function combine(n: number, k: number): number[][] {
  const result: number[][] = [];
  const path: number[] = [];
  const backtrack = (start: number): void => {
    if (path.length === k) {
      result.push([...path]);
      return;
    }
    // отсечение: чисел после start должно хватить, чтобы добрать до k
    for (let x = start; x <= n - (k - path.length) + 1; x++) {
      path.push(x);
      backtrack(x + 1);
      path.pop();
    }
  };
  backtrack(1);
  return result;
}

// --- 46. Permutations ---
function permute(nums: number[]): number[][] {
  const result: number[][] = [];
  const path: number[] = [];
  const used = new Array(nums.length).fill(false);
  const backtrack = (): void => {
    if (path.length === nums.length) {
      result.push([...path]);
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      path.push(nums[i]);
      backtrack();
      path.pop();
      used[i] = false;
    }
  };
  backtrack();
  return result;
}

// --- 39. Combination Sum ---
function combinationSum(candidates: number[], target: number): number[][] {
  const sorted = [...candidates].sort((a, b) => a - b);
  const result: number[][] = [];
  const path: number[] = [];
  const backtrack = (start: number, rest: number): void => {
    if (rest === 0) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < sorted.length && sorted[i] <= rest; i++) {   // дальше только больше — стоп
      path.push(sorted[i]);
      backtrack(i, rest - sorted[i]);             // i, а не i + 1: число можно брать снова
      path.pop();
    }
  };
  backtrack(0, target);
  return result;
}

// --- 52. N-Queens II ---
function totalNQueens(n: number): number {
  const cols = new Set<number>();
  const diagonals = new Set<number>();            // r - c одинаково на диагонали «\»
  const antiDiagonals = new Set<number>();        // r + c одинаково на диагонали «/»
  const place = (r: number): number => {
    if (r === n) return 1;
    let count = 0;
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || diagonals.has(r - c) || antiDiagonals.has(r + c)) continue;
      cols.add(c);
      diagonals.add(r - c);
      antiDiagonals.add(r + c);
      count += place(r + 1);
      cols.delete(c);
      diagonals.delete(r - c);
      antiDiagonals.delete(r + c);
    }
    return count;
  };
  return place(0);
}

// --- 22. Generate Parentheses ---
function generateParenthesis(n: number): string[] {
  const result: string[] = [];
  const backtrack = (s: string, open: number, close: number): void => {
    if (s.length === 2 * n) {
      result.push(s);
      return;
    }
    if (open < n) backtrack(s + '(', open + 1, close);
    if (close < open) backtrack(s + ')', open, close + 1);   // закрыть можно только открытую
  };
  backtrack('', 0, 0);
  return result;
}

// --- 79. Word Search ---
function exist(board: string[][], word: string): boolean {
  const m = board.length;
  const n = board[0].length;
  const dfs = (r: number, c: number, i: number): boolean => {
    if (i === word.length) return true;
    if (r < 0 || r >= m || c < 0 || c >= n || board[r][c] !== word[i]) return false;
    const saved = board[r][c];
    board[r][c] = '#';                            // занять клетку на время пути
    const found = dfs(r + 1, c, i + 1) || dfs(r - 1, c, i + 1) || dfs(r, c + 1, i + 1) || dfs(r, c - 1, i + 1);
    board[r][c] = saved;                          // вернуть при откате
    return found;
  };
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) if (dfs(r, c, 0)) return true;
  return false;
}

// ===== проверки =====
const key = (xs: number[][]) => xs.map((x) => x.join(',')).sort();

// шаблон
assert.deepEqual(key(subsets([1, 2, 3])), key([[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]));
for (let n = 0; n <= 10; n++) assert.equal(subsets(Array.from({ length: n }, (_, i) => i)).length, 2 ** n);

// 17
assert.deepEqual(letterCombinations('23'), ['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf']);
assert.deepEqual(letterCombinations(''), []);
assert.deepEqual(letterCombinations('2'), ['a', 'b', 'c']);
assert.equal(letterCombinations('79').length, 16);

// 77
assert.deepEqual(combine(4, 2), [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]);
assert.deepEqual(combine(1, 1), [[1]]);
const binom = (n: number, k: number): number => (k === 0 || k === n ? 1 : binom(n - 1, k - 1) + binom(n - 1, k));
for (let n = 1; n <= 10; n++) for (let k = 1; k <= n; k++) {
  const all = combine(n, k);
  assert.equal(all.length, binom(n, k));
  assert.equal(new Set(all.map((x) => x.join(','))).size, all.length);
  // те же сочетания, что подмножества размера k
  assert.deepEqual(key(all), key(subsets(Array.from({ length: n }, (_, i) => i + 1)).filter((s) => s.length === k)));
}

// 46
assert.deepEqual(permute([1, 2, 3]), [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]);
assert.deepEqual(permute([1]), [[1]]);
for (let n = 1; n <= 7; n++) {
  const all = permute(Array.from({ length: n }, (_, i) => i));
  assert.equal(all.length, [1, 1, 2, 6, 24, 120, 720, 5040][n]);
  assert.equal(new Set(all.map((x) => x.join(','))).size, all.length);
}

// 39
assert.deepEqual(key(combinationSum([2, 3, 6, 7], 7)), key([[2, 2, 3], [7]]));
assert.deepEqual(key(combinationSum([2, 3, 5], 8)), key([[2, 2, 2, 2], [2, 3, 3], [3, 5]]));
assert.deepEqual(combinationSum([2], 1), []);
fuzz(300, () => ({ cands: [...new Set(Array.from({ length: randInt(1, 4) }, () => randInt(2, 9)))], target: randInt(1, 20) }), ({ cands, target }) => {
  // эталон: перебор кратностей каждого числа
  const expected: number[][] = [];
  const sorted = [...cands].sort((a, b) => a - b);
  const go = (i: number, rest: number, path: number[]) => {
    if (i === sorted.length) { if (rest === 0) expected.push(path); return; }
    for (let t = 0; t * sorted[i] <= rest; t++) go(i + 1, rest - t * sorted[i], [...path, ...Array(t).fill(sorted[i])]);
  };
  go(0, target, []);
  assert.deepEqual(key(combinationSum(cands, target)), key(expected));
});

// 52: известные числа решений
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(totalNQueens), [1, 0, 0, 2, 10, 4, 40, 92, 352]);

// 22
assert.deepEqual(generateParenthesis(3), ['((()))', '(()())', '(())()', '()(())', '()()()']);
assert.deepEqual(generateParenthesis(1), ['()']);
const catalan = [1, 1, 2, 5, 14, 42, 132, 429, 1430];
for (let n = 1; n <= 8; n++) {
  const all = generateParenthesis(n);
  assert.equal(all.length, catalan[n]);
  for (const s of all) {
    let depth = 0;
    for (const ch of s) { depth += ch === '(' ? 1 : -1; assert.ok(depth >= 0); }
    assert.equal(depth, 0);
  }
}

// 79
const b = () => [['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']];
assert.equal(exist(b(), 'ABCCED'), true);
assert.equal(exist(b(), 'SEE'), true);
assert.equal(exist(b(), 'ABCB'), false);
fuzz(500, () => { const m = randInt(1, 3), n = randInt(1, 3); return { board: Array.from({ length: m }, () => Array.from({ length: n }, () => randString(1, 'ab'))), word: randString(randInt(1, 5), 'ab') }; }, ({ board, word }) => {
  // эталон: перебор всех простых путей длины слова
  const m = board.length, n = board[0].length;
  const paths = (r: number, c: number, used: Set<number>, s: string): boolean => {
    if (r < 0 || c < 0 || r >= m || c >= n || used.has(r * n + c)) return false;
    const t = s + board[r][c];
    if (t === word) return true;
    if (t.length >= word.length) return false;
    const u = new Set(used).add(r * n + c);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => paths(r + dr, c + dc, u, t));
  };
  let expected = false;
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) expected ||= paths(r, c, new Set(), '');
  const copy = board.map((row) => [...row]);
  assert.equal(exist(copy, word), expected);
  assert.deepEqual(copy, board);                                                                   // доска восстановлена
});

console.log('backtracking ok');
