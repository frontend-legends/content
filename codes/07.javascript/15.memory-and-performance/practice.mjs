// flags: --expose-gc
// Глава 7.15 — «Практика»: страница с утечками и её исправление через AbortController; LRU-кеш на Map.
// run: node --expose-gc practice.mjs
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<main></main>');
async function collect() { for (let i = 0; i < 4; i++) { await new Promise((r) => setImmediate(r)); globalThis.gc(); } }

// исправленная страница: всё снимается одним abort()
function mountDashboard(root) {
  const controller = new window.AbortController(); // из того же окна, что и DOM
  const { signal } = controller;
  const report = { rows: new Array(1e5).fill(0) };
  const ref = new WeakRef(report);
  window.addEventListener('resize', () => report.rows.length, { signal });
  const id = setInterval(() => report.rows.length, 1000);
  signal.addEventListener('abort', () => clearInterval(id));
  return { unmount: () => controller.abort(), ref };
}
let page = mountDashboard(window.document.querySelector('main'));
const ref = page.ref;
await collect();
assert.notEqual(ref.deref(), undefined);
page.unmount(); page = null;
await collect();
assert.equal(ref.deref(), undefined);

// LRU: Map хранит порядок вставки — удаляем и вставляем заново при чтении, вытесняем первый ключ
class LRU {
  #map = new Map();
  constructor(limit) { this.limit = limit; }
  get(key) { if (!this.#map.has(key)) return undefined; const v = this.#map.get(key); this.#map.delete(key); this.#map.set(key, v); return v; }
  set(key, value) { this.#map.delete(key); this.#map.set(key, value); if (this.#map.size > this.limit) this.#map.delete(this.#map.keys().next().value); }
  keys() { return [...this.#map.keys()]; }
}
const lru = new LRU(2);
lru.set('a', 1); lru.set('b', 2); lru.get('a'); lru.set('c', 3);
assert.deepEqual(lru.keys(), ['a', 'c']);          // b вытеснен: к нему дольше всех не обращались
console.log('ok');
