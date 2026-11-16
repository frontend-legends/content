// Проверки к практике 1.13: check-then-act через await списывает дважды; асинхронный мьютекс на очереди
// промисов и Web Locks делают проверку и списание одной критической секцией.
// Запуск: cd codes && node run.mjs 01.computer-science/13.threads
import assert from 'node:assert/strict';

const save = () => new Promise((r) => setTimeout(r, 10));                                  // запрос к серверу

// гонка
{
  let balance = 100;
  async function withdraw(n) {
    if (balance >= n) {
      await save();
      balance -= n;
    }
  }
  await Promise.all([withdraw(80), withdraw(80)]);
  assert.equal(balance, -60);
}

// асинхронный мьютекс: следующая операция ждёт предыдущую
class Mutex {
  #last = Promise.resolve();
  run(fn) {
    const result = this.#last.then(fn);
    this.#last = result.catch(() => {});                                                  // ошибка не ломает очередь
    return result;
  }
}
{
  let balance = 100;
  const mutex = new Mutex();
  const withdraw = (n) => mutex.run(async () => {
    if (balance < n) throw new Error('недостаточно средств');
    await save();
    balance -= n;
  });
  const results = await Promise.allSettled([withdraw(80), withdraw(80)]);
  assert.equal(balance, 20);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'rejected']);
  await withdraw(20);                                                                      // после ошибки очередь работает
  assert.equal(balance, 0);
}

// Web Locks: то же, но замок общий для всех вкладок сайта
{
  let balance = 100;
  const withdraw = (n) => navigator.locks.request('balance', async () => {
    if (balance < n) return false;
    await save();
    balance -= n;
    return true;
  });
  assert.deepEqual(await Promise.all([withdraw(80), withdraw(80)]), [true, false]);
  assert.equal(balance, 20);
}

console.log('mutex ok');
