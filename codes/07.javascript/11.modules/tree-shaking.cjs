// Глава 7.11 — tree shaking в esbuild: неиспользуемый экспорт ESM удаляется, побочный эффект модуля остаётся,
// из CommonJS не удаляется ничего; sideEffects:false позволяет выбросить модуль целиком.
// run: node tree-shaking.cjs
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const path = require('node:path');
const fx = path.join(__dirname, '_fixtures');

function bundle(entry, extra = {}) {
  return esbuild.buildSync({ stdin: { contents: entry, resolveDir: fx }, bundle: true, write: false, format: 'esm', minifySyntax: true, ...extra }).outputFiles[0].text;
}

const fromEsm = bundle(`import { used } from './lib.mjs'; console.log(used());`);
assert.ok(fromEsm.includes("'used'") || fromEsm.includes('"used"'));
assert.ok(!fromEsm.includes('UNUSED_MARKER'));      // неиспользуемая функция удалена
assert.ok(fromEsm.includes('SIDE_EFFECT_MARKER'));  // побочный эффект верхнего уровня сохранён

const fromCjs = bundle(`import { used } from './lib.cjs'; console.log(used());`);
assert.ok(fromCjs.includes('UNUSED_MARKER'));       // из CommonJS ничего не выброшено

// импорт без использования: модуль с побочным эффектом остаётся, если не сказать, что эффектов нет
const unusedImport = bundle(`import './lib.mjs';`);
assert.ok(unusedImport.includes('SIDE_EFFECT_MARKER'));
const pure = bundle(`import { used } from './pure/lib.mjs';`); // в package.json пакета "sideEffects": false
assert.ok(!pure.includes('SIDE_EFFECT_MARKER'));    // sideEffects: false — модуль выброшен целиком
console.log('ok');
