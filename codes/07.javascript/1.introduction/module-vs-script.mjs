// Глава 7.01 — «Модуль или скрипт»: await на верхнем уровне работает только в ES-модуле,
// в классическом скрипте / CommonJS это SyntaxError; модуль при этом всегда strict.
// run: node module-vs-script.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const run = (type, code) => spawnSync(process.execPath, [`--input-type=${type}`, '-e', code], { encoding: 'utf8' });

// the article's example, with fetch stubbed so it runs offline
const example = `
globalThis.fetch = async () => ({ json: async () => [1, 2, 3] });
const users = await fetch('/api/users').then((r) => r.json());
setTimeout(() => console.log(users.length), 0);
`;

const asModule = run('module', example);
assert.equal(asModule.status, 0, asModule.stderr);
assert.equal(asModule.stdout.trim(), '3');

const asScript = run('commonjs', example);
assert.notEqual(asScript.status, 0);
assert.match(asScript.stderr, /SyntaxError/);

// modules are always strict: this in a plain call is undefined
const strictCheck = run('module', 'function f() { return typeof this; } console.log(f());');
assert.equal(strictCheck.stdout.trim(), 'undefined');

console.log('module: ok (prints 3) | commonjs: SyntaxError | module strict: this === undefined');
