// Проверки к 2.17: префиксное дерево — вставка, поиск слова и префикса, шаблон с точкой и поиск
// многих слов на доске; примеры из условий и случайные тесты против перебора.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/17.trie
import { assert, fuzz, randInt, randString } from '../_shared.ts';

// --- 208. Implement Trie (Prefix Tree) ---
class TrieNode {
  children = new Map<string, TrieNode>();
  isWord = false;
}

class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const c of word) {
      if (!node.children.has(c)) node.children.set(c, new TrieNode());
      node = node.children.get(c)!;
    }
    node.isWord = true;                           // здесь кончается слово
  }

  private walk(prefix: string): TrieNode | null {
    let node: TrieNode | undefined = this.root;
    for (const c of prefix) {
      node = node.children.get(c);
      if (!node) return null;
    }
    return node;
  }

  search(word: string): boolean {
    return this.walk(word)?.isWord ?? false;
  }

  startsWith(prefix: string): boolean {
    return this.walk(prefix) !== null;
  }
}

// --- 211. Design Add and Search Words Data Structure ---
class WordDictionary {
  private root = new TrieNode();

  addWord(word: string): void {
    let node = this.root;
    for (const c of word) {
      if (!node.children.has(c)) node.children.set(c, new TrieNode());
      node = node.children.get(c)!;
    }
    node.isWord = true;
  }

  search(word: string): boolean {
    const match = (node: TrieNode, i: number): boolean => {
      if (i === word.length) return node.isWord;
      if (word[i] === '.') {                      // точка — любой символ: пробуем всех детей
        for (const child of node.children.values()) if (match(child, i + 1)) return true;
        return false;
      }
      const child = node.children.get(word[i]);
      return child ? match(child, i + 1) : false;
    };
    return match(this.root, 0);
  }
}

// --- 212. Word Search II ---
function findWords(board: string[][], words: string[]): string[] {
  type Node = { children: Map<string, Node>; word: string | null };
  const root: Node = { children: new Map(), word: null };
  for (const w of words) {
    let node = root;
    for (const c of w) {
      if (!node.children.has(c)) node.children.set(c, { children: new Map(), word: null });
      node = node.children.get(c)!;
    }
    node.word = w;
  }
  const m = board.length;
  const n = board[0].length;
  const found: string[] = [];
  const dfs = (r: number, c: number, parent: Node): void => {
    const ch = board[r][c];
    const node = parent.children.get(ch);
    if (!node) return;                            // такого префикса нет ни у одного слова
    if (node.word) {
      found.push(node.word);
      node.word = null;                           // не находить слово дважды
    }
    board[r][c] = '#';                            // клетку не использовать повторно в этом слове
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < m && nc >= 0 && nc < n && board[nr][nc] !== '#') dfs(nr, nc, node);
    }
    board[r][c] = ch;
    if (node.children.size === 0 && !node.word) parent.children.delete(ch);   // обрезать исчерпанную ветку
  };
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) dfs(r, c, root);
  return found;
}

// ===== проверки =====
// 208
const trie = new Trie();
trie.insert('apple');
assert.equal(trie.search('apple'), true);
assert.equal(trie.search('app'), false);
assert.equal(trie.startsWith('app'), true);
trie.insert('app');
assert.equal(trie.search('app'), true);
fuzz(300, () => [Array.from({ length: randInt(0, 8) }, () => randString(randInt(1, 4), 'ab')), Array.from({ length: 6 }, () => randString(randInt(0, 4), 'ab'))] as const, ([inserted, queries]) => {
  const t = new Trie();
  inserted.forEach((w) => t.insert(w));
  for (const q of queries) {
    if (q) assert.equal(t.search(q), inserted.includes(q));
    assert.equal(t.startsWith(q), inserted.some((w) => w.startsWith(q)) || q === '');
  }
});

// 211
const dict = new WordDictionary();
['bad', 'dad', 'mad'].forEach((w) => dict.addWord(w));
assert.deepEqual(['pad', 'bad', '.ad', 'b..', '...', '....'].map((w) => dict.search(w)), [false, true, true, true, true, false]);
fuzz(300, () => [Array.from({ length: randInt(0, 8) }, () => randString(randInt(1, 4), 'ab')), Array.from({ length: 6 }, () => randString(randInt(1, 4), 'ab.'))] as const, ([added, queries]) => {
  const d = new WordDictionary();
  added.forEach((w) => d.addWord(w));
  for (const q of queries) assert.equal(d.search(q), added.some((w) => new RegExp(`^${q}$`).test(w)));
});

// 212
const board = [['o', 'a', 'a', 'n'], ['e', 't', 'a', 'e'], ['i', 'h', 'k', 'r'], ['i', 'f', 'l', 'v']];
assert.deepEqual(findWords(board.map((r) => [...r]), ['oath', 'pea', 'eat', 'rain']).sort(), ['eat', 'oath']);
assert.deepEqual(findWords([['a', 'b'], ['c', 'd']], ['abcb']), []);                                // клетку нельзя взять дважды
fuzz(300, () => { const m = randInt(1, 3), n = randInt(1, 3); return { b: Array.from({ length: m }, () => Array.from({ length: n }, () => randString(1, 'abc'))), words: [...new Set(Array.from({ length: randInt(1, 6) }, () => randString(randInt(1, 4), 'abc')))] }; }, ({ b, words }) => {
  // перебор: для каждого слова — поиск пути отдельно
  const exists = (w: string) => {
    const m = b.length, n = b[0].length, used = new Set<string>();
    const go = (r: number, c: number, i: number): boolean => {
      if (r < 0 || c < 0 || r >= m || c >= n || used.has(`${r},${c}`) || b[r][c] !== w[i]) return false;
      if (i === w.length - 1) return true;
      used.add(`${r},${c}`);
      const ok = go(r + 1, c, i + 1) || go(r - 1, c, i + 1) || go(r, c + 1, i + 1) || go(r, c - 1, i + 1);
      used.delete(`${r},${c}`);
      return ok;
    };
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) if (go(r, c, 0)) return true;
    return false;
  };
  assert.deepEqual(findWords(b.map((r) => [...r]), words).sort(), words.filter(exists).sort());
});

console.log('trie ok');
