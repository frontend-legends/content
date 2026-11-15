// Глава 7.04 — рекурсия: глубина стека ограничена (RangeError), хвостовые вызовы V8 не оптимизирует,
// обход дерева рекурсивно и через явный стек.
// run: node recursion.cjs
const assert = require('node:assert/strict');

function depth(n) { return depth(n + 1) + 1; }
let max = 0;
function probe(n) { max = n; probe(n + 1); }
try { probe(0); } catch (e) {
  assert.ok(e instanceof RangeError);
  assert.equal(e.message, 'Maximum call stack size exceeded');
}
console.log(`глубина стека в этом процессе Node: ~${max}`);
assert.ok(max > 1000 && max < 1e6);

// хвостовой вызов не спасает: V8 не реализует proper tail calls
function sumTail(n, acc = 0) { return n === 0 ? acc : sumTail(n - 1, acc + n); }
assert.equal(sumTail(1000), 500500);
assert.throws(() => sumTail(max * 2), RangeError);

// дерево категорий: рекурсия и итеративная версия дают одно и то же
const tree = { name: 'Посуда', children: [{ name: 'Чайники', children: [{ name: 'Электрические', children: [] }] }, { name: 'Кружки', children: [] }] };
const walk = (node, out = []) => { out.push(node.name); node.children.forEach((c) => walk(c, out)); return out; };
function walkIter(root) {
  const out = []; const stack = [root];
  while (stack.length) { const node = stack.pop(); out.push(node.name); for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]); }
  return out;
}
assert.deepEqual(walk(tree), ['Посуда', 'Чайники', 'Электрические', 'Кружки']);
assert.deepEqual(walkIter(tree), walk(tree));
// глубокая цепочка: рекурсия падает, явный стек — нет
let chain = { name: 'leaf', children: [] };
for (let i = 0; i < max * 2; i++) chain = { name: 'n', children: [chain] };
assert.throws(() => walk(chain), RangeError);
assert.equal(walkIter(chain).length, max * 2 + 1);
console.log('ok');
