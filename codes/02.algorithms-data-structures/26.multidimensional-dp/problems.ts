// Проверки к 2.26: многомерное динамическое программирование — треугольник, пути по сетке, самый
// длинный палиндром, чередование строк, расстояние редактирования, акции с k сделками и наибольший
// квадрат; примеры из условий и случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/26.multidimensional-dp
import { assert, fuzz, randArray, randInt, randString, random } from '../_shared.ts';

// --- шаблон: таблица по двум строкам — наибольшая общая подпоследовательность ---
function longestCommonSubsequence(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1                    // последние символы совпали — берём оба
        : Math.max(dp[i - 1][j], dp[i][j - 1]);   // иначе выбрасываем один из них
    }
  }
  return dp[a.length][b.length];
}

// --- 120. Triangle ---
function minimumTotal(triangle: number[][]): number {
  const best = [...triangle.at(-1)!];             // снизу вверх: лучший путь от клетки до низа
  for (let r = triangle.length - 2; r >= 0; r--) {
    for (let c = 0; c <= r; c++) best[c] = triangle[r][c] + Math.min(best[c], best[c + 1]);
  }
  return best[0];
}

// --- 64. Minimum Path Sum ---
function minPathSum(grid: number[][]): number {
  const n = grid[0].length;
  const dp = new Array(n).fill(Infinity);         // одна строка: dp[c] — лучший путь до клетки
  dp[0] = 0;
  for (const row of grid) {
    dp[0] += row[0];
    for (let c = 1; c < n; c++) dp[c] = row[c] + Math.min(dp[c], dp[c - 1]);   // сверху или слева
  }
  return dp[n - 1];
}

// --- 63. Unique Paths II ---
function uniquePathsWithObstacles(grid: number[][]): number {
  const n = grid[0].length;
  const dp = new Array(n).fill(0);
  dp[0] = 1;
  for (const row of grid) {
    for (let c = 0; c < n; c++) {
      if (row[c] === 1) dp[c] = 0;                // в препятствие путей нет
      else if (c > 0) dp[c] += dp[c - 1];         // сверху (уже в dp[c]) плюс слева
    }
  }
  return dp[n - 1];
}

// --- 5. Longest Palindromic Substring ---
function longestPalindrome(s: string): string {
  let start = 0;
  let length = 0;
  const expand = (lo: number, hi: number): void => {
    while (lo >= 0 && hi < s.length && s[lo] === s[hi]) {
      lo--;
      hi++;
    }
    if (hi - lo - 1 > length) {
      start = lo + 1;
      length = hi - lo - 1;
    }
  };
  for (let i = 0; i < s.length; i++) {
    expand(i, i);                                 // нечётная длина: центр — символ
    expand(i, i + 1);                             // чётная: центр между символами
  }
  return s.slice(start, start + length);
}

// --- 97. Interleaving String ---
function isInterleave(s1: string, s2: string, s3: string): boolean {
  const m = s1.length;
  const n = s2.length;
  if (m + n !== s3.length) return false;
  const dp = new Array(n + 1).fill(false);        // dp[j] — из s1[0..i) и s2[0..j) собирается s3[0..i+j)
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) dp[j] = true;
      else {
        const fromS1 = i > 0 && dp[j] && s1[i - 1] === s3[i + j - 1];
        const fromS2 = j > 0 && dp[j - 1] && s2[j - 1] === s3[i + j - 1];
        dp[j] = fromS1 || fromS2;
      }
    }
  }
  return dp[n];
}

// --- 72. Edit Distance ---
function minDistance(word1: string, word2: string): number {
  const m = word1.length;
  const n = word2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (word1[i - 1] === word2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(
        dp[i - 1][j - 1],                         // заменить
        dp[i - 1][j],                             // удалить из word1
        dp[i][j - 1],                             // вставить в word1
      );
    }
  }
  return dp[m][n];
}

// --- 188. Best Time to Buy and Sell Stock IV ---
function maxProfitK(k: number, prices: number[]): number {
  const buy = new Array(k + 1).fill(-Infinity);   // buy[t] — лучший баланс с открытой t-й сделкой
  const sell = new Array(k + 1).fill(0);          // sell[t] — лучший баланс после t закрытых сделок
  for (const p of prices) {
    for (let t = 1; t <= k; t++) {
      buy[t] = Math.max(buy[t], sell[t - 1] - p); // купить сегодня после t - 1 сделок
      sell[t] = Math.max(sell[t], buy[t] + p);    // продать сегодня
    }
  }
  return sell[k];
}

// --- 123. Best Time to Buy and Sell Stock III ---
function maxProfit(prices: number[]): number {
  return maxProfitK(2, prices);
}

// --- 221. Maximal Square ---
function maximalSquare(matrix: string[][]): number {
  const n = matrix[0].length;
  const dp = new Array(n + 1).fill(0);            // dp[c + 1] — сторона квадрата с правым нижним углом в клетке
  let side = 0;
  for (const row of matrix) {
    let diagonal = 0;                             // dp[c] из предыдущей строки
    for (let c = 0; c < n; c++) {
      const above = dp[c + 1];
      dp[c + 1] = row[c] === '1' ? 1 + Math.min(above, dp[c], diagonal) : 0;
      diagonal = above;
      side = Math.max(side, dp[c + 1]);
    }
  }
  return side * side;
}

// ===== проверки =====
// шаблон
assert.equal(longestCommonSubsequence('abcde', 'ace'), 3);
assert.equal(longestCommonSubsequence('abc', 'def'), 0);
fuzz(500, () => [randString(randInt(0, 8), 'abc'), randString(randInt(0, 8), 'abc')], ([a, b]) => {
  let best = 0;
  for (let mask = 0; mask < 1 << a.length; mask++) {
    const sub = [...a].filter((_, i) => (mask >> i) & 1);
    let k = 0;
    for (const ch of b) if (k < sub.length && sub[k] === ch) k++;
    if (k === sub.length) best = Math.max(best, sub.length);
  }
  assert.equal(longestCommonSubsequence(a, b), best);
});

// 120
assert.equal(minimumTotal([[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]), 11);
assert.equal(minimumTotal([[-10]]), -10);
fuzz(500, () => Array.from({ length: randInt(1, 7) }, (_, r) => randArray(r + 1, -9, 9)), (t) => {
  const walk = (r: number, c: number): number => (r === t.length ? 0 : t[r][c] + Math.min(walk(r + 1, c), walk(r + 1, c + 1)));
  assert.equal(minimumTotal(t), walk(0, 0));
});

// 64, 63
assert.equal(minPathSum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]), 7);
assert.equal(minPathSum([[1, 2, 3], [4, 5, 6]]), 12);
assert.equal(uniquePathsWithObstacles([[0, 0, 0], [0, 1, 0], [0, 0, 0]]), 2);
assert.equal(uniquePathsWithObstacles([[0, 1], [0, 0]]), 1);
assert.equal(uniquePathsWithObstacles([[1]]), 0);
fuzz(500, () => { const m = randInt(1, 5), n = randInt(1, 5); return { g: Array.from({ length: m }, () => randArray(n, 0, 9)), o: Array.from({ length: m }, () => Array.from({ length: n }, () => (random() < 0.25 ? 1 : 0))) }; }, ({ g, o }) => {
  const m = g.length, n = g[0].length;
  const sum = (r: number, c: number): number => (r === m - 1 && c === n - 1 ? g[r][c] : g[r][c] + Math.min(r + 1 < m ? sum(r + 1, c) : Infinity, c + 1 < n ? sum(r, c + 1) : Infinity));
  assert.equal(minPathSum(g), sum(0, 0));
  const paths = (r: number, c: number): number => (r >= m || c >= n || o[r][c] ? 0 : r === m - 1 && c === n - 1 ? 1 : paths(r + 1, c) + paths(r, c + 1));
  assert.equal(uniquePathsWithObstacles(o), paths(0, 0));
});

// 5
assert.ok(['bab', 'aba'].includes(longestPalindrome('babad')));
assert.equal(longestPalindrome('cbbd'), 'bb');
assert.equal(longestPalindrome('a'), 'a');
fuzz(1000, () => randString(randInt(1, 12), 'ab'), (s) => {
  let best = 0;
  for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) { const t = s.slice(i, j + 1); if (t === [...t].reverse().join('')) best = Math.max(best, t.length); }
  const got = longestPalindrome(s);
  assert.equal(got.length, best);
  assert.ok(s.includes(got) && got === [...got].reverse().join(''));
});

// 97
assert.equal(isInterleave('aabcc', 'dbbca', 'aadbbcbcac'), true);
assert.equal(isInterleave('aabcc', 'dbbca', 'aadbbbaccc'), false);
assert.equal(isInterleave('', '', ''), true);
fuzz(1000, () => { const a = randString(randInt(0, 5), 'ab'), b = randString(randInt(0, 5), 'ab'); return { a, b, c: random() < 0.5 ? randString(a.length + b.length, 'ab') : [...a + b].sort(() => random() - 0.5).join('') }; }, ({ a, b, c }) => {
  const can = (i: number, j: number): boolean => (i + j === c.length ? true : (i < a.length && a[i] === c[i + j] && can(i + 1, j)) || (j < b.length && b[j] === c[i + j] && can(i, j + 1)));
  assert.equal(isInterleave(a, b, c), a.length + b.length === c.length && can(0, 0));
});

// 72
assert.equal(minDistance('horse', 'ros'), 3);
assert.equal(minDistance('intention', 'execution'), 5);
assert.equal(minDistance('', 'abc'), 3);
fuzz(500, () => [randString(randInt(0, 5), 'abc'), randString(randInt(0, 5), 'abc')], ([a, b]) => {
  // эталон: обход в ширину по строкам — каждая операция стоит 1
  const seen = new Map([[a, 0]]); const q = [a];
  for (let h = 0; h < q.length && !seen.has(b); h++) {
    const s = q[h], d = seen.get(s)!, next: string[] = [];
    for (let i = 0; i <= s.length; i++) for (const ch of 'abc') { next.push(s.slice(0, i) + ch + s.slice(i)); if (i < s.length) next.push(s.slice(0, i) + ch + s.slice(i + 1)); }
    for (let i = 0; i < s.length; i++) next.push(s.slice(0, i) + s.slice(i + 1));
    for (const t of next) if (t.length <= 6 && !seen.has(t)) { seen.set(t, d + 1); q.push(t); }
  }
  assert.equal(minDistance(a, b), seen.get(b));
});

// 123, 188
assert.equal(maxProfit([3, 3, 5, 0, 0, 3, 1, 4]), 6);
assert.equal(maxProfit([1, 2, 3, 4, 5]), 4);
assert.equal(maxProfit([7, 6, 4, 3, 1]), 0);
assert.equal(maxProfitK(2, [2, 4, 1]), 2);
assert.equal(maxProfitK(2, [3, 2, 6, 5, 0, 3]), 7);
fuzz(500, () => ({ k: randInt(1, 3), p: randArray(randInt(0, 8), 0, 9) }), ({ k, p }) => {
  // эталон: перебор состояний «день, сделок осталось, держим ли»
  const go = (d: number, left: number, holding: boolean): number => {
    if (d === p.length) return 0;
    let best = go(d + 1, left, holding);
    if (holding) best = Math.max(best, p[d] + go(d + 1, left - 1, false));
    else if (left > 0) best = Math.max(best, -p[d] + go(d + 1, left, true));
    return best;
  };
  assert.equal(maxProfitK(k, p), go(0, k, false));
});

// 221
assert.equal(maximalSquare([['1', '0', '1', '0', '0'], ['1', '0', '1', '1', '1'], ['1', '1', '1', '1', '1'], ['1', '0', '0', '1', '0']]), 4);
assert.equal(maximalSquare([['0', '1'], ['1', '0']]), 1);
assert.equal(maximalSquare([['0']]), 0);
fuzz(500, () => { const m = randInt(1, 6), n = randInt(1, 6); return Array.from({ length: m }, () => Array.from({ length: n }, () => (random() < 0.7 ? '1' : '0'))); }, (g) => {
  let best = 0;
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) for (let s = 1; r + s <= g.length && c + s <= g[0].length; s++) {
    let all = true;
    for (let i = r; i < r + s; i++) for (let j = c; j < c + s; j++) if (g[i][j] !== '1') all = false;
    if (all) best = Math.max(best, s * s);
  }
  assert.equal(maximalSquare(g), best);
});

console.log('multidimensional dp ok');
