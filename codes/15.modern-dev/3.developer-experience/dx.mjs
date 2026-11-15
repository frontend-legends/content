// Проверки к 15.03: цикл обратной связи (HMR Vite против полной сборки), сообщения об ошибках React
// в разработке и в продакшене, расчёт метрик DORA по журналу выкладок.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { project, write, run, bin, codesDir } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

// --- цикл обратной связи ---
const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'index.html': '<!doctype html><div id="app"></div><script type="module" src="/main.js"></script>',
  'main.js': "import { title } from './title.js';\ndocument.getElementById('app').textContent = title;\nif (import.meta.hot) import.meta.hot.accept('./title.js', (m) => { document.getElementById('app').textContent = m.title; });\n",
  'title.js': "export const title = 'Каталог v1';\n",
});
const { createServer } = await import(join(dir, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: dir, logLevel: 'silent', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
let hmrMs;
try {
  hmrMs = await withPage(async (page) => {
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('app').textContent === 'Каталог v1');
    const started = performance.now();
    write(dir, 'title.js', "export const title = 'Каталог v2';\n");
    await page.waitForFunction(() => document.getElementById('app').textContent === 'Каталог v2', null, { timeout: 10000 });
    return performance.now() - started;
  });
} finally {
  await server.close();
}
const t0 = performance.now();
const built = run(bin('vite'), ['build', '--logLevel', 'error'], { cwd: dir });
const buildMs = performance.now() - t0;
assert.equal(built.status, 0, built.out);
console.log(`  правка → экран: HMR ${hmrMs.toFixed(0)} мс, полная сборка ${buildMs.toFixed(0)} мс`);
assert.ok(hmrMs < buildMs, `${hmrMs} < ${buildMs}`);

// --- ошибки: в разработке — объяснение, в продакшене — номер и ссылка ---
const renderInvalid = (env) => spawnSync(process.execPath, ['-e', `
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { flushSync } = require('react-dom');
  const root = createRoot(document.getElementById('root'), { onUncaughtError: (e) => process.stdout.write(e.message) });
  flushSync(() => root.render(React.createElement(undefined))); // компонент, который забыли экспортировать
`], { encoding: 'utf8', env: { ...process.env, NODE_ENV: env }, cwd: codesDir }).stdout;
const devError = renderInvalid('development');
const prodError = renderInvalid('production');
assert.match(devError, /Element type is invalid: expected a string \(for built-in components\) or a class\/function \(for composite components\) but got: undefined/);
assert.match(devError, /You likely forgot to export your component from the file it's defined in/);
assert.match(prodError, /^Minified React error #130; visit https:\/\/react\.dev\/errors\/130\?args\[\]=undefined/);

// --- метрики DORA по журналу выкладок за неделю ---
const deploys = [
  { at: '2026-11-09T10:00', commitAt: '2026-11-08T15:00', failed: false },
  { at: '2026-11-10T11:00', commitAt: '2026-11-10T09:00', failed: true, restoredAt: '2026-11-10T11:40' },
  { at: '2026-11-11T16:00', commitAt: '2026-11-11T12:00', failed: false },
  { at: '2026-11-12T10:00', commitAt: '2026-11-11T18:00', failed: false },
  { at: '2026-11-13T15:00', commitAt: '2026-11-13T14:00', failed: true, restoredAt: '2026-11-13T15:20' },
];
const hours = (a, b) => (new Date(b) - new Date(a)) / 36e5;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const dora = {
  deploysPerDay: deploys.length / 7,
  leadTimeHours: median(deploys.map((d) => hours(d.commitAt, d.at))),
  changeFailureRate: deploys.filter((d) => d.failed).length / deploys.length,
  timeToRestoreMinutes: median(deploys.filter((d) => d.failed).map((d) => hours(d.at, d.restoredAt) * 60)),
};
assert.deepEqual({ ...dora, deploysPerDay: Math.round(dora.deploysPerDay * 100) / 100 }, {
  deploysPerDay: 0.71, leadTimeHours: 4, changeFailureRate: 0.4, timeToRestoreMinutes: 30,
});

console.log('dx ok');
