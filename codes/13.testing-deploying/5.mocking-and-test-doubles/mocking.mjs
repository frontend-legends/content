// Проверки к 13.05: дублёры в Vitest, подъём vi.mock, clear/reset/restore, фейковое время с промисами, MSW.
import assert from 'node:assert/strict';
import { project, run, bin, vitest, read } from '../../_lib/project.mjs';

// --- spy и stub в одной vi.fn ---
const roles = vitest({ 'roles.test.js': `import { test, expect, vi } from 'vitest';
test('stub отвечает, spy запоминает', async () => {
  const getUser = vi.fn().mockResolvedValue({ name: 'Аня' });
  const onLogin = vi.fn();
  const login = async (id) => onLogin((await getUser(id)).name);
  await login(7);
  expect(getUser).toHaveBeenCalledWith(7);
  expect(onLogin).toHaveBeenCalledExactlyOnceWith('Аня');
});` });
assert.equal(roles.numPassedTests, 1, roles.out);

// --- vi.mock поднимается в начало файла: переменные снаружи фабрики ещё не созданы ---
const mod = { 'analytics.js': "export const track = () => { throw new Error('настоящая аналитика в тесте'); };\n" };
const hoistDir = project({ 'package.json': JSON.stringify({ type: 'module' }), ...mod, 'hoist.test.js': `import { test, expect, vi } from 'vitest';
const track = vi.fn();
vi.mock('./analytics.js', () => ({ track }));
import { track as t } from './analytics.js';
test('событие', () => { t('buy'); expect(track).toHaveBeenCalledWith('buy'); });` });
const hoisted = run(bin('vitest'), ['run'], { cwd: hoistDir });
assert.notEqual(hoisted.status, 0);
assert.match(hoisted.out, /make sure there are no top level variables inside, since this call is hoisted to top of the file/);
assert.match(hoisted.out, /Cannot access 'track' before initialization/);
// vi.hoisted создаёт переменную тоже в начале файла
const fixedHoist = vitest({ ...mod, 'hoist.test.js': `import { test, expect, vi } from 'vitest';
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('./analytics.js', () => ({ track }));
import { track as t } from './analytics.js';
test('событие', () => { t('buy'); expect(track).toHaveBeenCalledWith('buy'); });` });
assert.equal(fixedHoist.numPassedTests, 1, fixedHoist.out);

// --- clear, reset, restore ---
const modes = vitest({ 'modes.test.js': `import { test, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
const api = { price: () => 1200 };
test('режимы сброса', () => {
  const original = api.price;
  const spy = vi.spyOn(api, 'price').mockReturnValue(1);
  const fn = vi.fn(() => 'impl').mockReturnValue('stub');
  api.price(); fn();
  vi.clearAllMocks();
  const clear = [spy.mock.calls.length, api.price(), fn()];
  vi.resetAllMocks();
  const reset = [api.price(), fn(), api.price === original];
  vi.restoreAllMocks();
  const restore = [api.price(), api.price === original];
  writeFileSync('out.json', JSON.stringify({ clear, reset, restore }));
});` });
assert.deepEqual(JSON.parse(read(modes.dir, 'out.json')), {
  clear: [0, 1, 'stub'],          // история вызовов стёрта, подменённые ответы остались
  reset: [1200, 'impl', false],   // ответы сброшены к исходной реализации, но метод ещё шпион
  restore: [1200, true],          // на объекте снова настоящий метод
});

// --- фейковое время: синхронная промотка не прокручивает промисы между таймерами ---
const timers = vitest({ 'timers.test.js': `import { test, expect, vi, beforeEach, afterEach } from 'vitest';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(state) { await wait(1000); state.tries++; await wait(1000); state.tries++; state.done = true; }

test('debounce: один вызов после паузы', () => {
  const search = vi.fn();
  let t; const onInput = (q) => { clearTimeout(t); t = setTimeout(() => search(q), 300); };
  onInput('п'); onInput('пу'); onInput('пуэр');
  vi.advanceTimersByTime(299);
  expect(search).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(search).toHaveBeenCalledExactlyOnceWith('пуэр');
});

test('синхронная промотка: второй таймер ещё не создан', () => {
  const s = { tries: 0, done: false }; retry(s);
  vi.advanceTimersByTime(2000);
  expect(s).toEqual({ tries: 0, done: false });
});

test('асинхронная промотка проходит цепочку', async () => {
  const s = { tries: 0, done: false }; retry(s);
  await vi.advanceTimersByTimeAsync(2000);
  expect(s).toEqual({ tries: 2, done: true });
});

test('setSystemTime', () => {
  vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
  expect(new Date().toISOString()).toBe('2026-11-15T10:00:00.000Z');
});` });
assert.equal(timers.numPassedTests, 4, timers.out);

// --- MSW: один обработчик для fetch и axios; необработанный запрос по умолчанию уходит в сеть ---
// «настоящий» сервер живёт в процессе тестов и считает дошедшие до него запросы
const mswTest = (policy) => `import { test, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
let hits = 0;
const real = createServer((req, res) => { hits++; res.end('{"real":true}'); });
let base;
const server = setupServer(http.get('*/api/products/7', () => HttpResponse.json({ title: 'Пуэр', price: 1200 })));
beforeAll(async () => {
  await new Promise((r) => real.listen(0, r));
  base = 'http://localhost:' + real.address().port;
  server.listen(${policy});
});
afterAll(() => { server.close(); real.close(); writeFileSync('hits.json', String(hits)); });
test('fetch получает подменённый ответ', async () => {
  expect(await (await fetch(base + '/api/products/7')).json()).toEqual({ title: 'Пуэр', price: 1200 });
});
test('axios — тот же обработчик', async () => {
  expect((await axios.get(base + '/api/products/7')).data).toEqual({ title: 'Пуэр', price: 1200 });
});
test('запрос без обработчика', async () => {
  const res = await fetch(base + '/api/reviews/7');
  expect(await res.json()).toEqual({ real: true });
});`;
const warn = vitest({ 'msw.test.js': mswTest('') });
assert.equal(warn.numPassedTests, 3, warn.out);
assert.equal(read(warn.dir, 'hits.json'), '1'); // по умолчанию onUnhandledRequest: 'warn' — запрос дошёл до настоящего сервера

const strict = vitest({ 'msw.test.js': mswTest("{ onUnhandledRequest: 'error' }") });
assert.equal(read(strict.dir, 'hits.json'), '0'); // с 'error' — не дошёл
const unhandled = strict.tests.find((t) => t.name === 'запрос без обработчика');
assert.equal(unhandled.status, 'failed');
assert.equal(strict.tests.filter((t) => t.status === 'passed').length, 2);

console.log('mocking ok');
