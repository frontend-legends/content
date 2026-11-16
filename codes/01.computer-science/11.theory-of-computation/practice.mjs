// Проверки к практике 1.11: регулярка названия товара с вложенными квантификаторами экспоненциальна,
// исправленная описывает тот же язык и линейна; isBalanced; автомат оплаты вместо флагов.
// Запуск: cd codes && node run.mjs 01.computer-science/11.theory-of-computation
import assert from 'node:assert/strict';

const evil = /^([a-zа-яё0-9]+\s?)+$/i;
const safe = /^[a-zа-яё0-9]+(?:\s[a-zа-яё0-9]+)*\s?$/i;
for (const s of ['Улун', 'Улун молочный', 'Улун молочный ', 'Те Гуань Инь 2024', 'Улун  двойной', 'Улун!', ' Улун', '']) {
  assert.equal(safe.test(s), evil.test(s), JSON.stringify(s));                           // язык тот же
}
const time = (re, s) => { const t = performance.now(); re.test(s); return performance.now() - t; };
const slow = time(evil, 'a'.repeat(24) + '!');
const fast = time(safe, 'a'.repeat(1e6) + '!');
assert.ok(slow > fast * 5, `исходная на 24 символах: ${slow.toFixed(1)} мс, исправленная на миллионе: ${fast.toFixed(1)} мс`);
assert.ok(time(evil, 'a'.repeat(22) + '!') > time(evil, 'a'.repeat(18) + '!') * 4);       // рост экспоненциальный

function isBalanced(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}
assert.deepEqual(['([]{})', '([)]', '((', '(]', 'f(a[1]) { x }', ''].map(isBalanced), [true, false, false, false, true, true]);

const machine = {
  idle: { PAY: 'paying' },
  paying: { SUCCESS: 'success', FAILURE: 'error' },
  error: { PAY: 'paying' },
  success: {},
};
let state = 'idle';
const sent = [];
function send(event) {
  const next = machine[state][event] ?? state;
  if (event === 'PAY' && next === 'paying' && state !== 'paying') sent.push('запрос');
  state = next;
}
for (const e of ['PAY', 'PAY', 'FAILURE', 'PAY', 'SUCCESS', 'PAY']) send(e);
assert.equal(state, 'success');
assert.equal(sent.length, 2);                                                               // повторный PAY во время оплаты не отправил запрос

console.log('practice ok');
