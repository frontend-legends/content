// Проверки к 15.05: один модуль на веб-API в рантайме Cloudflare Workers (workerd через Miniflare) и в Node.js;
// чего в edge-рантайме нет; состояние изолята; модель задержки «edge далеко от базы».
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { project } from '../../_lib/project.mjs';

const scriptPath = fileURLToPath(new URL('./_middleware.mjs', import.meta.url));
const node = (await import('./_middleware.mjs')).default;

async function both(path, { country, cookie } = {}) {
  const mf = new Miniflare({ modules: true, scriptPath, cf: { country: country ?? 'RU' } });
  try {
    const init = { redirect: 'manual', headers: cookie ? { cookie } : {} };
    const w = await mf.dispatchFetch(`https://shop.example${path}`, init);
    const n = await node.fetch(new Request(`https://shop.example${path}`, { headers: { ...(cookie ? { cookie } : {}), 'x-country': country ?? 'RU' } }));
    const pack = async (r) => ({ status: r.status, location: r.headers.get('location'), variant: r.headers.get('x-variant'), body: r.status === 200 ? (({ handled, ...rest }) => rest)(await r.json()) : null });
    return { workerd: await pack(w), node: await pack(n) };
  } finally { await mf.dispose(); }
}

// --- тот же код, тот же результат в двух рантаймах ---
const geo = await both('/catalog', { country: 'KZ' });
assert.deepEqual(geo.workerd, { status: 302, location: 'https://shop.example/kz/catalog', variant: null, body: null });
assert.deepEqual(geo.node, geo.workerd);

const auth = await both('/orders/7');
assert.equal(auth.workerd.location, 'https://shop.example/login?next=%2Forders%2F7');
assert.deepEqual(auth.node, auth.workerd);

const ab = await both('/catalog', { cookie: 'vid=visitor-42' });
assert.deepEqual(ab.node, ab.workerd);                  // одна и та же группа для одного посетителя
assert.match(ab.workerd.variant, /^[AB]$/);
assert.deepEqual(ab.workerd.body, { path: '/catalog', country: 'RU', variant: ab.workerd.variant });

// --- чего нет в рантайме Workers и что появляется с флагом совместимости ---
const probeDir = project({
  'globals.js': `export default { fetch: () => Response.json({ process: typeof process, require: typeof require, fs: typeof globalThis.fs, subtle: typeof crypto.subtle, caches: typeof caches }) };`,
  'buffer.js': `import { Buffer } from 'node:buffer';\nexport default { fetch: () => new Response(Buffer.from('пуэр').toString('base64')) };`,
}, { linkModules: false });
const run = async (file, opts = {}) => {
  const mf = new Miniflare({ modules: true, modulesRoot: probeDir, scriptPath: `${probeDir}/${file}`, cf: { country: 'RU' }, ...opts });
  try { return await (await mf.dispatchFetch('http://localhost/')).text(); } finally { await mf.dispose(); }
};
assert.deepEqual(JSON.parse(await run('globals.js')), { process: 'undefined', require: 'undefined', fs: 'undefined', subtle: 'object', caches: 'object' });
await assert.rejects(run("buffer.js"), /dependency "node:buffer": no matching module rules/); // без флага совместимости модуля нет
assert.equal(await run('buffer.js', { compatibilityDate: '2025-09-01', compatibilityFlags: ['nodejs_compat'] }), Buffer.from('пуэр').toString('base64'));

// --- глобальное состояние изолята переживает запрос, но на него нельзя полагаться ---
{
  const mf = new Miniflare({ modules: true, scriptPath, cf: { country: 'RU' } });
  try {
    const a = await (await mf.dispatchFetch('https://shop.example/')).json();
    const b = await (await mf.dispatchFetch('https://shop.example/')).json();
    assert.deepEqual([a.handled, b.handled], [1, 2]); // тот же изолят
  } finally { await mf.dispose(); }
  const fresh = new Miniflare({ modules: true, scriptPath, cf: { country: 'RU' } });
  try { assert.equal((await (await fresh.dispatchFetch('https://shop.example/')).json()).handled, 1); } finally { await fresh.dispose(); } // новый изолят — с нуля
}

// --- модель задержки: пользователь в Токио, база во Франкфурте ---
// время до первого байта ≈ путь пользователь→вычисления + запросы к базе × путь вычисления→база
const rtt = { userToEdge: 10, userToOrigin: 240, edgeToDb: 240, originToDb: 2 };
const ttfb = (where, queries) => (where === 'edge' ? rtt.userToEdge + queries * rtt.edgeToDb : rtt.userToOrigin + queries * rtt.originToDb);
assert.equal(ttfb('edge', 0), 10);    // редирект, проверка cookie, A/B — edge выигрывает
assert.equal(ttfb('origin', 0), 240);
assert.equal(ttfb('edge', 3), 730);   // три запроса к далёкой базе — edge проигрывает втрое
assert.equal(ttfb('origin', 3), 246);

console.log('edge ok');
