// Проверка главы 02: код решений в тексте совпадает с кодом в codes/.
// Для каждой темы с `reviewed` берутся все блоки ```ts и ищутся (без учёта пробелов)
// в .ts-файлах папки этой темы. Блоки, помеченные первой строкой `// схема`, не проверяются.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/sync
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chapter = join(here, '..', '..', '02.algorithms-data-structures');
const squash = (s) => s.replace(/\s+/g, '');
let checked = 0;
const shared = readFileSync(join(here, '_shared.ts'), 'utf8');                     // ListNode, TreeNode

for (const file of readdirSync(chapter).filter((f) => f.endsWith('.md'))) {
  const md = readFileSync(join(chapter, file), 'utf8');
  if (!/^reviewed:/m.test(md)) continue;
  const topic = file.replace(/\.md$/, '');
  const dir = join(here, topic);
  assert.ok(existsSync(dir), `нет папки codes для ${topic}`);
  const code = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => squash(readFileSync(join(dir, f), 'utf8'))).join('\n') + squash(shared);
  // все блоки ts темы: шаблоны и решения
  for (const [, body] of md.matchAll(/```ts\n([\s\S]*?)```/g)) {
    if (body.startsWith('// схема')) continue;
    assert.ok(code.includes(squash(body)), `${topic}: код из текста не найден в codes:\n${body.slice(0, 300)}`);
    checked++;
  }
}
console.log(`sync ok: ${checked} блоков кода совпадают`);
