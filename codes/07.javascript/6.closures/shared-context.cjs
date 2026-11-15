// flags: --expose-gc
// Глава 7.06 — память: функции одного вызова делят контекст. Большой объект, который нужен только
// одной функции, живёт, пока жива любая из них. Проверка на настоящем сборщике мусора V8.
// run: node --expose-gc shared-context.cjs
const assert = require('node:assert/strict');

async function collected(makeHolder) {
  let ref;
  const holder = (() => { const r = makeHolder(); ref = r.ref; return r.keep; })();
  for (let i = 0; i < 5; i++) { await new Promise((res) => setImmediate(res)); global.gc(); }
  const alive = ref.deref() !== undefined;
  holder(); // держим функцию живой до проверки
  return !alive;
}

(async () => {
  // keep не использует big, и никто другой тоже — big собран
  const alone = await collected(() => {
    const big = { data: new Array(1e5).fill('x') };
    const ref = new WeakRef(big);
    return { keep: () => 1, ref };
  });
  // соседняя функция (даже не вызванная и не возвращённая) упоминает big — он в общем контексте и жив, пока жив keep
  const shared = await collected(() => {
    const big = { data: new Array(1e5).fill('x') };
    const ref = new WeakRef(big);
    function neverReturned() { return big.data.length; }
    return { keep: () => 1, ref };
  });
  console.log(`big собран: без соседа — ${alone}, с соседом, который его читает, — ${shared}`);
  assert.equal(alone, true);
  assert.equal(shared, false);
})().catch((e) => { console.log(e); process.exit(1); });
