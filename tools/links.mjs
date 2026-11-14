// Проверка внешних ссылок (внутренние проверяет lint.mjs). Нужна сеть, поэтому живёт отдельно от линтера.
//
//   node tools/links.mjs                       — главы, прошедшие стандарт (есть `reviewed`)
//   node tools/links.mjs 07.javascript         — файлы по подстроке пути
//
// Ничего не пишет на диск. 404/410 и ошибки сети — провал; 401/403/429 — предупреждение
// (сайты часто закрываются от ботов, такие ссылки проверь руками).
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function* walkMd(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'codes', 'tools'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkMd(p);
    else if (e.name.endsWith('.md') && dir !== ROOT) yield p;
  }
}

const files = [...walkMd(ROOT)].filter((f) => {
  const rel = relative(ROOT, f);
  if (filters.length) return filters.some((x) => rel.includes(x));
  return /^reviewed:/m.test(readFileSync(f, 'utf8').split('\n---')[0]);
});

const uses = new Map(); // url -> [file:line]
for (const f of files) {
  let inCode = false;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (/^\s*```/.test(l)) inCode = !inCode;
    if (inCode) return;
    for (const m of l.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
      const u = m[1];
      uses.set(u, [...(uses.get(u) ?? []), `${relative(ROOT, f)}:${i + 1}`]);
    }
  });
}

async function check(url) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; linkcheck)' } };
  try {
    let r = await fetch(url, { ...opts, method: 'HEAD' });
    if (r.status >= 400) r = await fetch(url, { ...opts, method: 'GET' });
    return r.status;
  } catch (e) {
    return `сеть: ${e.cause?.code ?? e.name}`;
  }
}

const urls = [...uses.keys()];
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < urls.length) {
    const u = urls[next++];
    results.push([u, await check(u)]);
  }
}));

let bad = 0, soft = 0;
for (const [u, s] of results.sort()) {
  const hard = typeof s === 'string' || s === 404 || s === 410 || s >= 500;
  const warn = [401, 403, 429].includes(s);
  if (!hard && !warn) continue;
  if (hard) bad++; else soft++;
  console.log(`${hard ? '✗' : '!'} ${s}  ${u}\n    ${uses.get(u).join(', ')}`);
}
console.log(`\n${urls.length} ссылок в ${files.length} файл(ах) · ${bad} битых · ${soft} проверить руками`);
process.exit(bad ? 1 : 0);
