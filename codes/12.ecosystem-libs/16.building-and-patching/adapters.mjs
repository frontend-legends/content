// Проверки к 12.16: ядро без фреймворка и тонкие адаптеры — на примере TanStack Query.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { project } from '../../_lib/project.mjs';

const require = createRequire(import.meta.url);
const deps = (name) => require(`${name}/package.json`).dependencies ?? {};

// оба адаптера зависят от одного ядра
const core = require('@tanstack/query-core/package.json');
assert.equal(deps('@tanstack/react-query')['@tanstack/query-core'], core.version);
assert.equal(deps('@tanstack/vue-query')['@tanstack/query-core'], core.version);
// ядро не зависит ни от React, ни от Vue
assert.deepEqual(Object.keys(core.dependencies ?? {}), []);
assert.deepEqual(Object.keys(core.peerDependencies ?? {}), []);

// размер: ядро против адаптера, фреймворк и ядро — внешние
const { rolldown } = await import('rolldown');
async function size(code, external) {
  const dir = project({ 'entry.js': code });
  const bundle = await rolldown({ input: join(dir, 'entry.js'), platform: 'browser', logLevel: 'silent', cwd: dir, external });
  const { output } = await bundle.generate({ format: 'es', minify: true });
  return gzipSync(output[0].code).length;
}
const coreSize = await size(`import { QueryClient, QueryObserver } from '@tanstack/query-core'; console.log(QueryClient, QueryObserver);`, []);
const reactAdapter = await size(`import { useQuery, QueryClientProvider } from '@tanstack/react-query'; console.log(useQuery, QueryClientProvider);`, ['react', 'react/jsx-runtime', /^@tanstack\/query-core/]);
console.log(`  query-core ${(coreSize / 1024).toFixed(1)} KB, react-адаптер useQuery ${(reactAdapter / 1024).toFixed(1)} KB gzip`);
assert.ok(reactAdapter * 3 < coreSize, 'адаптер в разы меньше ядра');

console.log('adapters ok');
