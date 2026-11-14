// Глава 7.01 — практика «Что выведет?»: оторванный метод класса и bind
// run: node practice-logger.mjs
import assert from 'node:assert/strict';

class Logger {
  prefix = '[app] ';
  log(m) { return this.prefix + m; }
}
const { log } = new Logger();
assert.throws(() => log('hi'), { name: 'TypeError', message: "Cannot read properties of undefined (reading 'prefix')" });
const logger = new Logger();
const bound = logger.log.bind(logger);
assert.equal(bound('hi'), '[app] hi');
const t = setTimeout(() => {}); assert.equal(t.constructor.name, 'Timeout'); // Node: объект, браузер: число clearTimeout(t);
