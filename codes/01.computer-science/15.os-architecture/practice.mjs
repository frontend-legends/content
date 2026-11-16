// Проверки к практике 1.15: атомарная запись с fsync и rename; mapLimit держит не больше limit операций
// одновременно и сохраняет порядок результатов; перенаправление > отправляет в файл только stdout, 2>&1 — оба потока.
// Запуск: cd codes && node run.mjs 01.computer-science/15.os-architecture
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const dir = fs.mkdtempSync(join(os.tmpdir(), 'os-practice-'));

// --- атомарная запись ---
function writeAtomic(path, data) {
  const tmp = `${path}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  fs.writeSync(fd, data);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, path);
}
const config = join(dir, 'config.json');
writeAtomic(config, JSON.stringify({ theme: 'dark' }));
writeAtomic(config, JSON.stringify({ theme: 'light' }));
assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), { theme: 'light' });
assert.deepEqual(fs.readdirSync(dir), ['config.json']);                                     // временных файлов не осталось

// --- mapLimit ---
async function mapLimit(items, limit, fn) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
let active = 0, peak = 0;
const out = await mapLimit(Array.from({ length: 100 }, (_, i) => i), 16, async (x) => {
  active++; peak = Math.max(peak, active);
  await new Promise((r) => setTimeout(r, Math.random() * 5));
  active--;
  return x * 2;
});
assert.equal(peak, 16);
assert.deepEqual(out, Array.from({ length: 100 }, (_, i) => i * 2));

// --- перенаправление потоков ---
const log = join(dir, 'build.log');
const node = `"${process.execPath}" -e "console.log('собрано'); console.error('ошибка сборки')"`;
const onlyStdout = spawnSync('sh', ['-c', `${node} > "${log}"`], { encoding: 'utf8' });
assert.equal(fs.readFileSync(log, 'utf8'), 'собрано\n');
assert.equal(onlyStdout.stderr, 'ошибка сборки\n');                                          // ушло мимо файла
spawnSync('sh', ['-c', `${node} > "${log}" 2>&1`]);
assert.equal(fs.readFileSync(log, 'utf8'), 'собрано\nошибка сборки\n');

fs.rmSync(dir, { recursive: true, force: true });
console.log('practice ok');
