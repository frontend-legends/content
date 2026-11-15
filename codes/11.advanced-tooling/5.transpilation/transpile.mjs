// Глава 11.05 — транспиляция: синтаксис понижается, API — нет (нужен полифил); что понизить нельзя;
// browserslist; Babel 8 по умолчанию не понижает; типы стираются без проверки; AST и плагин-кодмод.
// run: node transpile.mjs
import assert from 'node:assert/strict';
import { transformSync as esbuild } from 'esbuild';
import { transformSync as swc } from '@swc/core';
import { transformSync as babel, parseSync } from '@babel/core';
import { transformWithOxc } from 'vite';
import browserslist from 'browserslist';

const modern = `const city = user?.address?.city ?? 'не указан';
const last = items.at(-1);
const grouped = Object.groupBy(items, (i) => i.type);`;

// --- синтаксис понижается, вызовы API остаются как есть
for (const [name, out] of [
  ['esbuild', esbuild(modern, { target: 'chrome79' }).code],
  ['swc', swc(modern, { jsc: { target: 'es2019', parser: { syntax: 'ecmascript' } } }).code],
  ['babel', babel(modern, { presets: [['@babel/preset-env', { targets: { chrome: '79' } }]], configFile: false }).code],
  ['oxc', (await transformWithOxc(modern, 'x.js', { target: 'es2019' })).code],
]) {
  assert.doesNotMatch(out, /\?\.|\?\?/, name);              // ?. и ?? переписаны
  assert.match(out, /\.at\(-1\)/, name);                    // Array.prototype.at — не синтаксис, остался
  assert.match(out, /Object\.groupBy/, name);               // нужен полифил
}

// --- современная цель — ничего не трогать
assert.match(esbuild(modern, { target: 'es2022', charset: 'utf8' }).code, /user\?\.address\?\.city \?\? "не указан"/);
// по умолчанию esbuild экранирует не-ASCII символы
assert.match(esbuild("const s = 'чай';").code, /\\u0447\\u0430\\u0439/);

// --- что понизить нельзя
// top-level await и for await для старой цели — ошибка сборки
assert.throws(() => esbuild('const data = await load();', { target: 'es2017', format: 'esm' }), /Top-level await is not available/);
// регулярное выражение с флагом v превращается в new RegExp(…, "v") — упадёт уже в старом браузере
assert.equal(esbuild('const r = /[\\p{L}--[a-z]]/v;', { target: 'es2015' }).code.trim(), 'const r = new RegExp("[\\\\p{L}--[a-z]]", "v");');
// BigInt-литерал — вызов BigInt() и предупреждение «may crash at run-time»
{
  const r = esbuild('let x = 10n;', { target: 'es2019' });
  assert.match(r.code, /BigInt\("10"\)/);
  assert.match(r.warnings[0].text, /may crash at run-time/);
}
// приватные поля понижаются через WeakMap-помощники
assert.match(esbuild('class Cart { #items = []; }', { target: 'es2020' }).code, /__privateAdd|WeakMap/);

// --- browserslist превращает запрос в список браузеров
const list = browserslist('> 0.5%, last 2 versions, not dead');
assert.ok(list.length > 10);
assert.ok(list.every((b) => /^[a-z_]+ [\w.\-]+$/.test(b)));   // «браузер версия»
assert.ok(!list.some((b) => b.startsWith('ie ')));          // IE «мёртв»
const defaults = browserslist('defaults');
assert.ok(defaults.some((b) => b.startsWith('chrome ')));

// --- Babel 8 без targets не понижает до ES5
{
  const out = babel('const f = (a) => a?.b;', { presets: ['@babel/preset-env'], configFile: false }).code;   // нет targets и browserslist-конфига — берётся defaults
  assert.match(out, /=>/);                                   // стрелка осталась
}

// --- типы стираются без проверки
{
  const wrong = `const total: number = 'не число';\nexport { total };`;
  assert.match(esbuild(wrong, { loader: 'ts', charset: 'utf8' }).code, /const total = "не число"/);
  assert.match(swc(wrong, { jsc: { parser: { syntax: 'typescript' } } }).code, /total = 'не число'/);   // SWC без target понижает до ES5: var
}

// --- AST и плагин: удалить console.log при сборке
{
  const ast = parseSync('console.log(x);', { configFile: false });
  assert.equal(ast.program.body[0].type, 'ExpressionStatement');
  assert.equal(ast.program.body[0].expression.callee.type, 'MemberExpression');
  const removeConsoleLog = ({ types: t }) => ({
    visitor: {
      CallExpression(path) {
        const callee = path.get('callee');
        if (callee.isMemberExpression() && t.isIdentifier(callee.node.object, { name: 'console' }) && t.isIdentifier(callee.node.property, { name: 'log' })) {
          path.remove();
        }
      },
    },
  });
  const out = babel("console.log('debug'); console.error('fail'); run();", { plugins: [removeConsoleLog], configFile: false }).code;
  assert.equal(out, "console.error('fail');\nrun();");
}

// --- скорость: нативные трансформаторы быстрее Babel
{
  const big = Array.from({ length: 400 }, (_, i) => `export const f${i} = (a) => a?.b?.[${i}] ?? { ...a, n: ${i} };`).join('\n');
  const time = (fn) => { const t = performance.now(); for (let i = 0; i < 5; i++) fn(); return performance.now() - t; };
  const tBabel = time(() => babel(big, { presets: [['@babel/preset-env', { targets: { chrome: '79' } }]], configFile: false }));
  const tEsbuild = time(() => esbuild(big, { target: 'chrome79' }));
  const tSwc = time(() => swc(big, { jsc: { target: 'es2019' } }));
  console.log(`babel ${tBabel.toFixed(0)} мс, swc ${tSwc.toFixed(0)} мс, esbuild ${tEsbuild.toFixed(0)} мс`);
  assert.ok(tBabel > tEsbuild * 3 && tBabel > tSwc * 3);
}
console.log('transpile ok');
