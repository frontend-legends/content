// Прогоняет весь проверочный код книги. Каждый файл — то, что утверждает текст главы.
//   npm install && npm test             — все файлы
//   node run.mjs 09.reactjs             — только файлы, в пути которых есть подстрока
//
// Что запускается:
//   .js .cjs .mjs                       — node как есть
//   .ts .mts .cts .tsx .jsx             — node --import tsx (JSX — автоматический runtime React, см. tsconfig.json)
//   .ts .tsx дополнительно              — проверка типов tsc по tsconfig.json: ошибка типов = провал файла.
//                                         Утверждение «здесь TypeScript ругается» — строка с `// @ts-expect-error`.
// Заголовок файла (первые 6 строк):
//   // flags: --allow-natives-syntax    — флаги node
//   // types-only                       — только проверить типы, не запускать
// Папки, начинающиеся с `_` (например, _lib с хелперами), не запускаются.
// Ненулевой код выхода = провал.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? '';
const SELF = fileURLToPath(import.meta.url);

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(c|m)?(j|t)sx?$/.test(e.name) && !e.name.endsWith('.d.ts') && p !== SELF && dir !== root) yield p;
  }
}

const files = [...walk(root)].filter((f) => !filter || relative(root, f).includes(filter));
const isTs = (f) => /\.(c|m)?tsx?$/.test(f);
const needsLoader = (f) => /\.((c|m)?ts|tsx|jsx)$/.test(f);

// типы: один прогон tsc на весь проект, ошибки раскладываются по файлам
const typeErrors = new Map();
if (files.some(isTs)) {
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8', timeout: 180_000 });
  for (const l of (r.stdout + r.stderr).split('\n')) {
    const m = l.match(/^(.+?)\(\d+,\d+\): error TS\d+/);
    if (!m) continue;
    const abs = resolve(root, m[1]);
    typeErrors.set(abs, [...(typeErrors.get(abs) ?? []), l.replace(m[1], relative(root, abs))]);
  }
  if (r.status !== 0 && typeErrors.size === 0) {
    console.log('✗ tsc упал не на файле главы:\n' + (r.stdout + r.stderr).trim());
    process.exit(1);
  }
}

let failed = 0;
for (const file of files) {
  const rel = relative(root, file);
  const head = readFileSync(file, 'utf8').split('\n').slice(0, 6).join('\n');
  const flags = head.match(/^\/\/ flags: (.+)$/m)?.[1].split(/\s+/) ?? [];
  const typesOnly = /^\/\/ types-only\b/m.test(head);
  const out = [];
  let ok = true;

  if (typeErrors.has(file)) {
    ok = false;
    out.push(...typeErrors.get(file));
  }
  if (!typesOnly) {
    const argv = [...(needsLoader(file) ? ['--import', 'tsx'] : []), ...flags, file];
    const r = spawnSync(process.execPath, argv, { cwd: dirname(file), encoding: 'utf8', timeout: 60_000 });
    if (r.status !== 0) ok = false;
    const text = (r.stdout + (r.status === 0 ? '' : r.stderr)).trim();
    if (text) out.push(text);
  }

  if (!ok) failed++;
  const tags = [...flags, ...(typesOnly ? ['types-only'] : isTs(file) ? ['+tsc'] : [])];
  console.log(`\n${ok ? '✓' : '✗'} ${rel}${tags.length ? '  [' + tags.join(' ') + ']' : ''}`);
  if (out.length) console.log(out.join('\n').split('\n').map((l) => '  ' + l).join('\n'));
}
console.log(`\n${files.length - failed}/${files.length} ok (node ${process.version})`);
process.exit(failed ? 1 : 0);
