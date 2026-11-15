// Глава 7.14 — debounce и throttle на настоящих таймерах: сколько раз и с какими аргументами вызывается функция.
// run: node timing.mjs
import assert from 'node:assert/strict';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function debounce(fn, ms, { leading = false } = {}) {
  let timer = null;
  function debounced(...args) {
    const callNow = leading && timer === null;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (!leading) fn.apply(this, args); }, ms);
    if (callNow) fn.apply(this, args);
  }
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}

function throttle(fn, ms) {
  let last = 0; let timer = null; let pendingArgs = null; let pendingThis = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer); timer = null;
      last = now; fn.apply(this, args);
    } else {
      pendingArgs = args; pendingThis = this;
      if (!timer) timer = setTimeout(() => { last = Date.now(); timer = null; fn.apply(pendingThis, pendingArgs); }, remaining);
    }
  };
}

// debounce: серия вызовов чаще, чем раз в 50 мс, — один вызов с последними аргументами
{
  const calls = [];
  const search = debounce((q) => calls.push(q), 50);
  for (const q of ['ч', 'ча', 'чай']) { search(q); await wait(10); }
  await wait(80);
  assert.deepEqual(calls, ['чай']);
  // this и аргументы сохраняются
  const input = { value: 'кофе', onInput: debounce(function () { calls.push(this.value); }, 20) };
  input.onInput(); await wait(40);
  assert.deepEqual(calls, ['чай', 'кофе']);
  // cancel отменяет запланированный вызов
  search('отменён'); search.cancel(); await wait(70);
  assert.equal(calls.includes('отменён'), false);
}

// leading: первый вызов сразу, остальные в серии — нет
{
  const calls = [];
  const save = debounce((v) => calls.push(v), 40, { leading: true });
  save(1); save(2); save(3);
  assert.deepEqual(calls, [1]);
  await wait(60);
  save(4);
  assert.deepEqual(calls, [1, 4]);
}

// throttle: не чаще раза в 50 мс, первый сразу, последний — в конце окна
{
  const calls = [];
  const onScroll = throttle((y) => calls.push(y), 50);
  const start = Date.now();
  let y = 0;
  while (Date.now() - start < 175) { onScroll(++y); await wait(5); }
  await wait(70);
  assert.equal(calls[0], 1);                            // первый — сразу
  assert.equal(calls.at(-1), y);                        // последний — с самыми свежими данными
  assert.ok(calls.length >= 4 && calls.length <= 6, `вызовов: ${calls.length} из ${y}`);
}
console.log('ok');
