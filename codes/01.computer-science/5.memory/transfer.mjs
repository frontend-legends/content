// Проверки к практике 1.05 в Chromium: пиксели canvas, перенесённые в воркер, пропадают в главном потоке;
// копия через slice() остаётся. Плюс пул объектов отдаёт те же объекты повторно.
// Запуск: cd codes && node run.mjs 01.computer-science/5.memory
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const r = await page.evaluate(async () => {
    const worker = new Worker(URL.createObjectURL(new Blob(['onmessage = (e) => postMessage(e.data.pixels.length)'], { type: 'text/javascript' })));
    const reply = () => new Promise((res) => { worker.onmessage = (e) => res(e.data); });
    const ctx = Object.assign(document.createElement('canvas'), { width: 100, height: 50 }).getContext('2d');

    const pixels = ctx.getImageData(0, 0, 100, 50).data;
    worker.postMessage({ pixels }, [pixels.buffer]);
    const transferred = { here: pixels.length, there: await reply(), detached: pixels.buffer.detached };

    const original = ctx.getImageData(0, 0, 100, 50).data;
    const copy = original.slice();
    worker.postMessage({ pixels: copy }, [copy.buffer]);
    const copied = { here: original.length, there: await reply() };
    worker.terminate();
    return { transferred, copied };
  });
  assert.deepEqual(r, {
    transferred: { here: 0, there: 20000, detached: true },
    copied: { here: 20000, there: 20000 },
  });
});

class Pool {
  #free = [];
  #create;
  constructor(create) { this.#create = create; }
  acquire() { return this.#free.pop() ?? this.#create(); }
  release(item) { this.#free.push(item); }
  get size() { return this.#free.length; }
}
let created = 0;
const particles = new Pool(() => { created++; return { x: 0, y: 0, vx: 0, vy: 0, life: 0 }; });
function spawn(x, y) {
  const p = particles.acquire();
  p.x = x; p.y = y; p.vx = Math.random() - 0.5; p.vy = -1; p.life = 60;
  return p;
}
const first = Array.from({ length: 100 }, (_, i) => spawn(i, i));
first.forEach((p) => particles.release(p));
const second = Array.from({ length: 100 }, (_, i) => spawn(i, 0));
assert.equal(created, 100);                                                          // новые объекты не создавались
assert.ok(second.every((p) => first.includes(p) && p.y === 0 && p.life === 60));
assert.equal(particles.size, 0);

console.log('transfer ok');
