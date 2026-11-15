// Глава 7.15 — поколения сборщика V8: короткоживущие объекты убирает быстрый Scavenge в молодом поколении,
// старое поколение — Mark-Compact. Запускаем отдельный процесс с --trace-gc.
// run: node generations.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const code = `
  let keep = [];
  for (let i = 0; i < 2e6; i++) { const tmp = { i, s: 'x' + i }; if (i % 1000 === 0) keep.push(tmp); }
  globalThis.gc();
`;
const r = spawnSync(process.execPath, ['--trace-gc', '--expose-gc', '-e', code], { encoding: 'utf8' });
const scavenges = (r.stdout.match(/Scavenge/g) ?? []).length;
const fullGcs = (r.stdout.match(/Mark-Compact/g) ?? []).length;
console.log(`Scavenge: ${scavenges}, Mark-Compact: ${fullGcs}`);
assert.ok(scavenges > 5);          // множество быстрых сборок молодого поколения
assert.ok(fullGcs >= 1);           // полная сборка — редкая (здесь — явный gc())
assert.ok(scavenges > fullGcs);
console.log('ok');
