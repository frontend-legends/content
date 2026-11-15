// Глава 8.06 — в .tsx стрелка-дженерик <T>(v) => v читается как JSX-тег; <T,> и <T extends unknown> — нет.
// run: node tsx-comma.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsc = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ts-tsx-'));
const check = (name, code) => {
  writeFileSync(join(dir, name), code);
  return spawnSync(process.execPath, [tsc, '--ignoreConfig', '--jsx', 'react-jsx', '--noEmit', join(dir, name)], { encoding: 'utf8' });
};

const bad = check('bad.tsx', 'export const identity = <T>(v: T): T => v;\n');
assert.notEqual(bad.status, 0);
assert.match(bad.stdout, /TS17008: JSX element 'T' has no corresponding closing tag/);

const ok = check('ok.tsx', 'export const a = <T,>(v: T): T => v;\nexport const b = <T extends unknown>(v: T): T => v;\n');
assert.equal(ok.status, 0, ok.stdout);

const ts = check('plain.ts', 'export const identity = <T>(v: T): T => v;\n');
assert.equal(ts.status, 0, ts.stdout);
console.log('tsx comma ok');
