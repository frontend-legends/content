// Проверки к 16.08: владение кодом (порядок правил CODEOWNERS — побеждает последнее совпавшее, как в документации GitHub),
// функция пригодности «у каждого файла есть владелец», «мощёная дорога» правилом настоящего ESLint
// и связанность изменений по истории настоящего git: файлы разных команд, которые меняются вместе.
import assert from 'node:assert/strict';
import ignore from 'ignore';
import { project, run, bin, cost } from '../../_lib/project.mjs';

// --- CODEOWNERS: шаблоны как в .gitignore, побеждает последнее совпавшее правило ---
const parse = (text) => text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [pattern, ...owners] = l.split(/\s+/); return { match: ignore().add(pattern), owners }; });
const ownersOf = (rules, file) => {
  let owners = null;
  for (const r of rules) if (r.match.ignores(file)) owners = r.owners; // последнее совпавшее перекрывает предыдущие
  return owners;
};

const files = ['src/catalog/ProductCard.tsx', 'src/cart/addToCart.ts', 'src/checkout/pay.ts', 'src/shared/ui/Button.tsx', 'src/shared/ui/button.css', 'src/reviews/List.tsx', 'package.json'];

// ошибка: общее правило в конце перекрыло все командные
const wrong = parse(`
/src/catalog/   @shop/catalog
/src/cart/      @shop/cart
/src/checkout/  @shop/cart
/src/shared/    @shop/platform
*               @shop/platform
`);
assert.deepEqual(files.map((f) => ownersOf(wrong, f)[0]), Array(files.length).fill('@shop/platform'));

// правильно: от общего к частному
const rules = parse(`
*               @shop/platform
/src/catalog/   @shop/catalog
/src/cart/      @shop/cart
/src/checkout/  @shop/cart
/src/shared/ui/ @shop/platform @shop/design
*.css           @shop/design
`);
assert.deepEqual(Object.fromEntries(files.map((f) => [f, ownersOf(rules, f).join(' ')])), {
  'src/catalog/ProductCard.tsx': '@shop/catalog',
  'src/cart/addToCart.ts': '@shop/cart',
  'src/checkout/pay.ts': '@shop/cart',
  'src/shared/ui/Button.tsx': '@shop/platform @shop/design',
  'src/shared/ui/button.css': '@shop/design',   // *.css ниже — перекрывает правило папки
  'src/reviews/List.tsx': '@shop/platform',     // своей строки нет — достаётся общему владельцу
  'package.json': '@shop/platform',
});

// функция пригодности: без строки «*» у новых папок нет владельца — CI это ловит
const noDefault = parse(`
/src/catalog/   @shop/catalog
/src/cart/      @shop/cart
/src/shared/    @shop/platform
`);
const orphans = files.filter((f) => !ownersOf(noDefault, f)?.length);
assert.deepEqual(orphans, ['src/checkout/pay.ts', 'src/reviews/List.tsx', 'package.json']);

// --- «мощёная дорога» как правило линтера: запрет с объяснением, куда идти ---
const eslintProject = (code) => {
  const dir = project({
    'package.json': JSON.stringify({ type: 'module' }),
    'eslint.config.js': `export default [{
  files: ['src/**/*.js'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{ name: 'moment', message: 'Даты — через date-fns, см. docs/dates.md' }],
      patterns: [{ group: ['@shop/*/internal/*'], message: 'Импортируйте публичный API пакета команды' }],
    }],
  },
}];\n`,
    'src/order.js': code,
  });
  const r = run(bin('eslint'), ['src', '--format', 'json'], { cwd: dir });
  return { status: r.status, messages: JSON.parse(r.stdout)[0].messages.map((m) => m.message) };
};
const bad = eslintProject("import moment from 'moment';\nimport { calc } from '@shop/cart/internal/price.js';\nexport const label = (d) => moment(d).format('DD.MM.YYYY') + calc();\n");
assert.equal(bad.status, 1);
assert.equal(bad.messages.length, 2);
assert.match(bad.messages[0], /'moment' import is restricted from being used\. Даты — через date-fns, см\. docs\/dates\.md/);
assert.match(bad.messages[1], /Импортируйте публичный API пакета команды/);
const good = eslintProject("import { format } from 'date-fns';\nimport { calc } from '@shop/cart';\nexport const label = (d) => format(d, 'dd.MM.yyyy') + calc();\n");
assert.equal(good.status, 0);
assert.deepEqual(good.messages, []);

// почему дорога именно такая: та же задача по весу (байты gzip после минификации)
const viaMoment = await cost("import moment from 'moment'; console.log(moment().format('DD.MM.YYYY'));");
const viaDateFns = await cost("import { format } from 'date-fns'; console.log(format(new Date(), 'dd.MM.yyyy'));");
assert.ok(viaMoment.gzip > 3 * viaDateFns.gzip, `${viaMoment.gzip} vs ${viaDateFns.gzip}`);
assert.ok(viaMoment.gzip > 15_000 && viaDateFns.gzip < 8_000);

// --- связанность изменений: что меняется вместе, по истории коммитов ---
const repo = project({}, { linkModules: false });
const git = (...args) => { const r = run('git', args, { cwd: repo }); assert.equal(r.status, 0, r.out); return r.stdout; };
git('init', '-q'); git('config', 'user.email', 'dev@example.com'); git('config', 'user.name', 'dev');
let n = 0;
const commit = (paths) => {
  n++;
  for (const p of paths) run('sh', ['-c', `mkdir -p $(dirname ${p}) && echo ${n} >> ${p}`], { cwd: repo });
  git('add', '-A'); git('commit', '-qm', `change ${n}`);
};
commit(['src/catalog/ProductCard.tsx', 'src/cart/addToCart.ts']);  // цена со скидкой: правят обе команды
commit(['src/catalog/ProductCard.tsx', 'src/cart/addToCart.ts']);
commit(['src/catalog/ProductCard.tsx', 'src/cart/addToCart.ts', 'src/cart/CartBadge.tsx']);
commit(['src/catalog/ProductCard.tsx']);
commit(['src/catalog/Filters.tsx', 'src/catalog/ProductCard.tsx']);
commit(['src/cart/addToCart.ts', 'src/cart/CartBadge.tsx']);
commit(['src/reviews/List.tsx']);

const log = git('log', '--name-only', '--format=format:--');
const commits = log.split('--\n').map((c) => c.split('\n').filter(Boolean)).filter((c) => c.length);
assert.equal(commits.length, 7);
const changes = {}, together = {};
for (const c of commits) {
  for (const f of c) changes[f] = (changes[f] ?? 0) + 1;
  for (const a of c) for (const b of c) if (a < b) together[`${a} + ${b}`] = (together[`${a} + ${b}`] ?? 0) + 1;
}
const coupling = Object.entries(together).map(([pair, k]) => {
  const [a, b] = pair.split(' + ');
  const cross = ownersOf(rules, a)[0] !== ownersOf(rules, b)[0];
  return { pair, k, degree: k / Math.min(changes[a], changes[b]), cross };
}).sort((x, y) => y.k - x.k);
const top = coupling[0];
assert.equal(top.pair, 'src/cart/addToCart.ts + src/catalog/ProductCard.tsx');
assert.equal(top.k, 3);
assert.equal(top.degree, 0.75);   // 3 из 4 изменений корзинной функции шли вместе с карточкой каталога
assert.equal(top.cross, true);    // и это файлы разных команд — граница проведена не там
const sameTeam = coupling.find((c) => c.pair === 'src/cart/CartBadge.tsx + src/cart/addToCart.ts');
assert.equal(sameTeam.k, 2);
assert.equal(sameTeam.cross, false); // внутри одной команды совместные изменения — норма

// --- число каналов общения растёт квадратично: n(n−1)/2 ---
const paths = (people) => (people * (people - 1)) / 2;
assert.deepEqual([5, 10, 50].map(paths), [10, 45, 1225]);
assert.equal(5 * paths(10), 225); // пять команд по десять человек: 225 каналов внутри команд вместо 1225

console.log('scale ok');
