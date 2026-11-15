// flags: --expose-gc
// Глава 7.15 — сборщик мусора на настоящем V8: циклы собираются, утечки через слушатель, таймер и отсоединённый
// DOM-узел в Map; WeakMap не держит ключ; WeakRef и FinalizationRegistry.
// run: node --expose-gc gc.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { JSDOM } from 'jsdom';

async function collect() { for (let i = 0; i < 4; i++) { await new Promise((r) => setImmediate(r)); globalThis.gc(); } }
// создаёт объект в отдельной функции, чтобы на него не осталось ссылок в этом стеке
function track(setup) { let ref; (() => { const obj = { big: new Array(1e5).fill(0) }; ref = new WeakRef(obj); setup(obj); })(); return ref; }

// цикл недостижимых объектов — собирается (не подсчёт ссылок, а достижимость)
{
  const ref = track((a) => { const b = { a }; a.b = b; });
  await collect();
  assert.equal(ref.deref(), undefined);
}

// слушатель на долгоживущем объекте держит всё, что замыкает
{
  const appBus = new EventEmitter();
  let handler;
  const ref = track((data) => { handler = () => data.big.length; appBus.on('resize', handler); });
  await collect();
  assert.notEqual(ref.deref(), undefined);       // жив: шина → слушатель → data
  appBus.off('resize', handler); handler = null;
  await collect();
  assert.equal(ref.deref(), undefined);
}

// забытый setInterval
{
  let id;
  const ref = track((data) => { id = setInterval(() => data.big.length, 1000); });
  await collect();
  assert.notEqual(ref.deref(), undefined);
  clearInterval(id);
  await collect();
  assert.equal(ref.deref(), undefined);
}

// отсоединённый DOM-узел: удалён со страницы, но жив, пока на него ссылается Map
{
  const { window } = new JSDOM('<ul id="list"></ul>');
  const cache = new Map();
  let ref;
  (() => {
    const li = window.document.createElement('li');
    window.document.getElementById('list').append(li);
    cache.set('row-1', li);
    ref = new WeakRef(li);
    li.remove();
  })();
  await collect();
  assert.notEqual(ref.deref(), undefined);
  cache.delete('row-1');
  await collect();
  assert.equal(ref.deref(), undefined);
}

// WeakMap не держит ключ; FinalizationRegistry сообщает о сборке
{
  const meta = new WeakMap();
  const finalized = [];
  const registry = new FinalizationRegistry((label) => finalized.push(label));
  const ref = track((obj) => { meta.set(obj, { seen: true }); registry.register(obj, 'товар 7'); });
  await collect();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ref.deref(), undefined);
  assert.deepEqual(finalized, ['товар 7']);
}
console.log('ok');
