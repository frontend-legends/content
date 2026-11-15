// Глава 11.08 — линтинг и форматирование: ESLint 10 (flat config, .eslintrc больше не читается, автоисправление,
// своё правило на AST), Prettier (стиль без логики, --check), Biome и Oxlint — и сравнение скорости.
// run: node lint.mjs
import assert from 'node:assert/strict';
import { ESLint, Linter } from 'eslint';
import js from '@eslint/js';
import * as prettier from 'prettier';
import { project, run, bin, write } from '../../_lib/project.mjs';

const code = `export function total(items) {
  let sum = 0
  for (const item of items) { if (item.price == null) continue; sum += item.price }
  const unused = 1
  debugger
  return sum
}
`;

// --- ESLint 10: конфигурация — только eslint.config.js
{
  const dir = project({ 'src/cart.js': code, '.eslintrc.json': '{ "rules": { "no-debugger": "error" } }' });
  const r = run(bin('eslint'), ['src'], { cwd: dir });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /ESLint couldn't find an eslint.config.\* file/);   // старый .eslintrc игнорируется
  write(dir, 'eslint.config.js', `import js from '@eslint/js';
export default [js.configs.recommended, { rules: { eqeqeq: ['error', 'always', { null: 'ignore' }] } }];`);
  write(dir, 'package.json', '{ "type": "module" }');
  const r2 = run(bin('eslint'), ['src', '--format', 'json'], { cwd: dir });
  const ids = JSON.parse(r2.stdout)[0].messages.map((m) => m.ruleId).sort();
  assert.deepEqual(ids, ['no-debugger', 'no-unused-vars']);   // == null разрешён настройкой eqeqeq
}

// --- автоисправление: только безопасные правки
{
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ rules: { 'prefer-const': 'error', 'no-var': 'error' } }], fix: true });
  const [res] = await eslint.lintText('var x = 1;\nlet y = 2;\nconsole.log(x, y);\n');
  assert.equal(res.output, 'const x = 1;\nconst y = 2;\nconsole.log(x, y);\n');   // var → let → const: исправления применяются в несколько проходов
}

// --- своё правило: запретить деньги во float — price * 100 без Math.round
assert.equal(1.15 * 100, 114.99999999999999);   // пример из текста
{
  const noFloatMoney = {
    meta: { type: 'problem', messages: { round: 'Копейки из рублей — только через Math.round()' } },
    create(context) {
      return {
        BinaryExpression(node) {
          if (node.operator !== '*') return;
          const isMoney = (n) => n.type === 'MemberExpression' && n.property.name === 'price';
          const isHundred = (n) => n.type === 'Literal' && n.value === 100;
          if (!((isMoney(node.left) && isHundred(node.right)) || (isMoney(node.right) && isHundred(node.left)))) return;
          const parent = node.parent;
          const rounded = parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && parent.callee.object.name === 'Math' && parent.callee.property.name === 'round';
          if (!rounded) context.report({ node, messageId: 'round' });
        },
      };
    },
  };
  const linter = new Linter();
  const cfg = [{ plugins: { shop: { rules: { 'no-float-money': noFloatMoney } } }, rules: { 'shop/no-float-money': 'error' } }];
  const bad = linter.verify('const kop = item.price * 100;', cfg);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].message, 'Копейки из рублей — только через Math.round()');
  assert.equal(linter.verify('const kop = Math.round(item.price * 100);', cfg).length, 0);
}

// --- Prettier: форматирует, логику не трогает, результат стабилен
{
  const out = await prettier.format(code, { parser: 'babel', singleQuote: true });
  assert.match(out, /let sum = 0;/);                     // точки с запятой расставлены
  assert.match(out, /debugger;/);                        // debugger остался: это не форматирование
  assert.match(out, /const unused = 1;/);
  assert.equal(await prettier.format(out, { parser: 'babel', singleQuote: true }), out);   // повторный запуск ничего не меняет
  const dir = project({ 'src/cart.js': code });
  const r = run(bin('prettier'), ['--check', 'src'], { cwd: dir });
  assert.equal(r.status, 1);                             // --check для CI: ненулевой код, если есть неотформатированное
}

// --- Biome: линтер и форматтер в одном
{
  const dir = project({ 'src/cart.js': code, 'biome.json': '{ "linter": { "enabled": true }, "formatter": { "enabled": true } }' });
  const r = run(bin('biome'), ['check', 'src', '--reporter=json'], { cwd: dir });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /noDebugger/);
  assert.match(r.out, /format/i);
}

// --- Oxlint и скорость: те же проверки на тысяче файлов
{
  const files = { 'eslint.config.js': "import js from '@eslint/js';\nexport default [js.configs.recommended];", 'package.json': '{ "type": "module" }' };
  // файлы реального размера: по 40 функций
  for (let i = 0; i < 1000; i++) files[`src/m${i}.js`] = Array.from({ length: 40 }, (_, j) => code.replace('total', `total${i}_${j}`)).join('\n');
  const dir = project(files);
  const timeIt = (cmd, args) => { const t = performance.now(); const r = run(cmd, args, { cwd: dir }); return { ms: performance.now() - t, r }; };
  const ox = timeIt(bin('oxlint'), ['src']);
  assert.match(ox.r.out, /no-debugger|debugger/);
  const es = timeIt(bin('eslint'), ['src']);
  assert.match(es.r.out, /no-debugger/);
  console.log(`1000 файлов: ESLint ${es.ms.toFixed(0)} мс, Oxlint ${ox.ms.toFixed(0)} мс, x${(es.ms / ox.ms).toFixed(0)}`);
  assert.ok(es.ms > ox.ms * 5);
}
void js; void Linter;
console.log('lint ok');
