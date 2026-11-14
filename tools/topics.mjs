// Карта тем: что уже разобрано и где. Собирается из заголовков ## и ### всех глав.
//
//   node tools/topics.mjs            — перезаписать TOPICS.md в корне репозитория
//   node tools/topics.mjs --stdout   — вывести, не записывая
//
// TOPICS.md не правится руками: после изменения глав карту пересобирает тот, кто сводит работу (не авторы тем).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/^\d+\./, '').replace(/\.md$/, '');
const num = (s) => Number(s.match(/^(\d+)\./)?.[1] ?? 0);
const SKIP_H2 = new Set(['Красные флаги в ответе', 'Как спрашивают на собеседовании', 'Практика', 'Полезные ссылки', 'Что мы разберём']);

const chapters = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d+\./.test(e.name))
  .map((e) => e.name)
  .sort((a, b) => num(a) - num(b));

const lines = [
  '# Карта тем',
  '',
  'Что уже разобрано и где: заголовки `##` и `###` всех глав. Файл собирается командой `node tools/topics.mjs` — руками не правится.',
  '',
  'Перед тем как писать про понятие, найди его здесь (и `grep -rli "<понятие>" --include="*.md" .`). Если у понятия уже есть свой раздел в другой теме — дай короткий контекст и ссылку, подробный разбор остаётся там.',
  '',
];

for (const ch of chapters) {
  const files = readdirSync(join(ROOT, ch)).filter((f) => f.endsWith('.md')).sort((a, b) => num(a) - num(b));
  const index = files.find((f) => f.startsWith('0.'));
  const chTitle = index ? YAML.parse(readFileSync(join(ROOT, ch, index), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '')?.title : ch;
  lines.push(`## ${num(ch)}. ${chTitle}`, '');
  for (const f of files) {
    if (f.startsWith('0.')) continue;
    const src = readFileSync(join(ROOT, ch, f), 'utf8');
    const fm = YAML.parse(src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') ?? {};
    let inCode = false;
    const heads = [];
    for (const l of src.split('\n')) {
      if (/^\s*```/.test(l)) inCode = !inCode;
      if (inCode) continue;
      const m = l.match(/^(##|###) (.+)$/);
      if (!m) continue;
      const t = m[2].replace(/\s+\{#.*\}$/, '').trim();
      if (m[1] === '##' && SKIP_H2.has(t)) continue;
      heads.push(m[1] === '##' ? `**${t}**` : t);
    }
    const order = typeof fm.order === 'number' ? fm.order.toFixed(2) : '?';
    const url = `/content/${strip(ch)}/${strip(f)}`;
    lines.push(`- **${order} ${fm.title ?? strip(f)}** — \`${url}\`${fm.reviewed ? ' · по стандарту' : ''}`);
    if (heads.length) lines.push(`  ${heads.join(' · ')}`);
  }
  lines.push('');
}

const out = lines.join('\n');
if (process.argv.includes('--stdout')) console.log(out);
else {
  writeFileSync(join(ROOT, 'TOPICS.md'), out);
  console.log(`TOPICS.md: ${lines.filter((l) => l.startsWith('- ')).length} тем`);
}
