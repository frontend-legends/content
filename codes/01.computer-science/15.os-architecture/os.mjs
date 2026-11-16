// Проверки к 1.15 в Node: виртуальная память выделяется лениво — rss растёт только при первом касании,
// и каждая новая страница — page fault; файловые дескрипторы — маленькие целые, 0–2 — стандартные потоки;
// жёсткая ссылка — та же запись inode, символическая — отдельный файл с путём; права доступа;
// атомарная замена файла через rename; лимит дескрипторов: EMFILE и исправление ограничением параллельности;
// stdout и stderr — разные потоки при перенаправлении; конвейер процессов.
// Запуск: cd codes && node run.mjs 01.computer-science/15.os-architecture
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

// --- ленивое выделение памяти ---
const mb = (n) => n / 2 ** 20;
const usage0 = process.resourceUsage();
const rss0 = process.memoryUsage().rss;
const buf = Buffer.alloc(200 * 2 ** 20);                                                  // 200 МБ нулей
const rss1 = process.memoryUsage().rss;
buf.fill(1);                                                                               // коснулись каждой страницы
const rss2 = process.memoryUsage().rss;
const faults = process.resourceUsage().minorPageFault - usage0.minorPageFault;
assert.ok(mb(rss1 - rss0) < 20, `после alloc: +${mb(rss1 - rss0).toFixed(1)} МБ`);
assert.ok(mb(rss2 - rss1) > 180, `после fill: +${mb(rss2 - rss1).toFixed(1)} МБ`);
const pages = (200 * 2 ** 20) / 16384;                                                     // страницы по 16 КБ на Apple M, по 4 КБ на x86
assert.ok(faults >= pages * 0.9, `page faults: ${faults}`);

// --- файловые дескрипторы ---
const dir = fs.mkdtempSync(join(os.tmpdir(), 'os-'));
const file = join(dir, 'orders.json');
fs.writeFileSync(file, '{"v":1}');
const fd = fs.openSync(file, 'r');
assert.ok(Number.isInteger(fd) && fd > 2);                                                 // 0, 1, 2 заняты стандартными потоками
fs.closeSync(fd);
const stdio = spawnSync(process.execPath, ['-e', 'require("fs").writeSync(1, "в stdout\\n"); require("fs").writeSync(2, "в stderr\\n")'], { encoding: 'utf8' });
assert.deepEqual([stdio.stdout, stdio.stderr], ['в stdout\n', 'в stderr\n']);

// --- ссылки: жёсткая — тот же inode, символическая — путь ---
fs.linkSync(file, join(dir, 'hard.json'));
fs.symlinkSync(file, join(dir, 'soft.json'));
assert.equal(fs.statSync(join(dir, 'hard.json')).ino, fs.statSync(file).ino);
assert.equal(fs.statSync(file).nlink, 2);
assert.equal(fs.lstatSync(join(dir, 'soft.json')).isSymbolicLink(), true);
fs.unlinkSync(file);                                                                       // удалили «оригинал»
assert.equal(fs.readFileSync(join(dir, 'hard.json'), 'utf8'), '{"v":1}');                // данные живы, пока есть ссылка
assert.throws(() => fs.readFileSync(join(dir, 'soft.json')), { code: 'ENOENT' });          // символическая указывает в пустоту

// --- права доступа ---
const secret = join(dir, 'secret.env');
fs.writeFileSync(secret, 'TOKEN=…', { mode: 0o600 });
assert.equal(fs.statSync(secret).mode & 0o777, 0o600);                                     // rw-------
fs.chmodSync(secret, 0o400);
if (process.getuid?.() !== 0) assert.throws(() => fs.writeFileSync(secret, 'x'), { code: 'EACCES' });

// --- атомарная запись: временный файл и rename ---
const config = join(dir, 'config.json');
fs.writeFileSync(config, JSON.stringify({ version: 1 }));
function writeAtomic(path, data) {
  const tmp = `${path}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, path);                                                                // замена целиком: старый или новый, без середины
}
const reader = fs.openSync(config, 'r');                                                   // кто-то держит старую версию открытой
writeAtomic(config, JSON.stringify({ version: 2 }));
assert.equal(fs.readFileSync(reader, 'utf8'), '{"version":1}');                           // открытый дескриптор видит старый inode
assert.equal(fs.readFileSync(config, 'utf8'), '{"version":2}');
fs.closeSync(reader);

// --- лимит дескрипторов ---
const many = Array.from({ length: 200 }, (_, i) => { const p = join(dir, `f${i}.txt`); fs.writeFileSync(p, String(i)); return p; });
const script = (limited) => `
  const fs = require('fs/promises');
  const files = ${JSON.stringify(many)};
  async function readAll() {
    ${limited
      ? `const out = []; let next = 0;
         const worker = async () => { while (next < files.length) { const i = next++; out[i] = await fs.readFile(files[i], 'utf8'); } };
         await Promise.all(Array.from({ length: 16 }, worker));
         return out;`
      : `return Promise.all(files.map(async (f) => { const h = await fs.open(f); await new Promise((r) => setTimeout(r, 20)); const t = await h.readFile('utf8'); await h.close(); return t; }));`}
  }
  const say = (t) => require('fs').writeSync(1, t + '\\n');                // console.log сам открыл бы дескриптор
  readAll().then((r) => say('ok ' + r.length), (e) => say(e.code));`;
const ulimit = (code) => spawnSync('sh', ['-c', `ulimit -n 64 && "${process.execPath}" -e "$0"`, code], { encoding: 'utf8' }).stdout.trim();
assert.equal(ulimit(script(false)), 'EMFILE');
assert.equal(ulimit(script(true)), 'ok 200');

// --- конвейер: stdout одного процесса — stdin другого ---
const pipe = spawnSync('sh', ['-c', `printf 'улун\\nпуэр\\nулун\\n' | "${process.execPath}" -e "let s=''; process.stdin.on('data', (d) => s += d).on('end', () => console.log(new Set(s.trim().split('\\\\n')).size))"`], { encoding: 'utf8' });
assert.equal(pipe.stdout.trim(), '2');

fs.rmSync(dir, { recursive: true, force: true });
console.log('os ok');
