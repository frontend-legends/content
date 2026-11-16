// Проверки к 1.10 на RxJS: Observable ленивый и холодный, отписка вызывает очистку, share делает поток горячим,
// shareReplay отдаёт последнее значение опоздавшим; стратегии выравнивания switchMap, mergeMap, concatMap,
// exhaustMap на виртуальном времени (TestScheduler); автодополнение; рывок (glitch) в combineLatest против
// сигналов без рывков; противодавление: асинхронный итератор не обгоняет медленного потребителя.
// Запуск: cd codes && node run.mjs 01.computer-science/10.reactive-programming
import assert from 'node:assert/strict';
import { Observable, BehaviorSubject, Subject, combineLatest, from, interval } from 'rxjs';
import { map, share, shareReplay, switchMap, mergeMap, concatMap, exhaustMap, debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { TestScheduler } from 'rxjs/testing';
import { signal, computed, effect } from '@preact/signals-core';

// --- ленивость и холодность ---
let runs = 0;
let cleanups = 0;
const prices$ = new Observable((subscriber) => {
  runs++;
  subscriber.next(450);
  subscriber.next(480);
  const id = setInterval(() => subscriber.next(500), 1000);
  return () => { cleanups++; clearInterval(id); };                                    // очистка при отписке
});
assert.equal(runs, 0);                                                                // без подписки ничего не произошло
const seen = [];
const s1 = prices$.subscribe((p) => seen.push(['первый', p]));
const s2 = prices$.subscribe((p) => seen.push(['второй', p]));
assert.equal(runs, 2);                                                                // каждая подписка — свой запуск
assert.deepEqual(seen, [['первый', 450], ['первый', 480], ['второй', 450], ['второй', 480]]);
s1.unsubscribe();
s2.unsubscribe();
assert.equal(cleanups, 2);

// --- share: один запуск на всех подписчиков; shareReplay: последнее значение опоздавшим ---
let requests = 0;
const user$ = new Observable((s) => { requests++; setTimeout(() => { s.next({ name: 'Аня' }); s.complete(); }, 10); });
const shared = user$.pipe(share());
const got = [];
shared.subscribe((u) => got.push(`шапка: ${u.name}`));
shared.subscribe((u) => got.push(`профиль: ${u.name}`));
await new Promise((r) => setTimeout(r, 30));
assert.equal(requests, 1);
assert.deepEqual(got, ['шапка: Аня', 'профиль: Аня']);
requests = 0;
const cached = user$.pipe(shareReplay(1));
await new Promise((r) => cached.subscribe(() => r()));
const late = await new Promise((r) => cached.subscribe((u) => r(u.name)));
assert.deepEqual([requests, late], [1, 'Аня']);
// без share — два запроса
requests = 0;
user$.subscribe();
user$.subscribe();
assert.equal(requests, 2);

// shareReplay с refCount: опоздавший получает значение без запроса, после отписки всех источник остановлен
{
  let started = 0, stopped = 0;
  const live$ = new Observable((s) => { started++; s.next('цена 450'); return () => { stopped++; }; })
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));
  const x1 = live$.subscribe();
  let lateValue;
  const x2 = live$.subscribe((v) => { lateValue = v; });
  assert.deepEqual([started, lateValue], [1, 'цена 450']);
  x1.unsubscribe(); x2.unsubscribe();
  assert.equal(stopped, 1);
}
// takeUntil: поток завершается вместе с компонентом
{
  const destroy$ = new Subject();
  let ticks = 0, cleaned = 0;
  new Observable(() => () => { cleaned++; }).pipe(takeUntil(destroy$)).subscribe();
  interval(1).pipe(takeUntil(destroy$)).subscribe(() => { ticks++; });
  await new Promise((r) => setTimeout(r, 20));
  destroy$.next();
  const frozen = ticks;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ticks, frozen);
  assert.equal(cleaned, 1);
}

// --- стратегии выравнивания на виртуальном времени ---
const marbles = {};
for (const [name, op] of Object.entries({ switchMap, mergeMap, concatMap, exhaustMap })) {
  new TestScheduler((actual) => { marbles[name] = actual.filter((n) => n.notification.kind === 'N').map((n) => `${n.frame}:${n.notification.value}`); })
    .run(({ cold, hot, expectObservable }) => {
      const clicks = hot('a-b-c-----|');
      expectObservable(clicks.pipe(op((x) => cold('---x|', { x: x.toUpperCase() })))).toBe('');
    });
}
assert.deepEqual(marbles, {
  switchMap: ['7:C'],                                     // каждый новый клик отменяет прошлый запрос
  mergeMap: ['3:A', '5:B', '7:C'],                        // все параллельно
  concatMap: ['3:A', '7:B', '11:C'],                      // очередью, по порядку
  exhaustMap: ['3:A'],                                    // b и c пришли до конца запроса A — проигнорированы
});

// --- автодополнение: debounce, без повторов, только последний ответ ---
new TestScheduler((a, e) => assert.deepEqual(a, e)).run(({ hot, cold, expectObservable }) => {
  //                 у ул улу    улу улун
  const input = hot('a-b-c-----d---e----------|', { a: 'у', b: 'ул', c: 'улу', d: 'улу', e: 'улун' });
  const search = (q) => cold(q === 'улу' ? '------------r|' : '--r|', { r: `результаты «${q}»` });
  const results = input.pipe(
    debounceTime(3),
    map((q) => q.trim()),
    filter((q) => q.length >= 2),
    distinctUntilChanged(),
    switchMap(search),
  );
  // «улу» ушло в кадре 7, повтор «улу» отброшен, «улун» в кадре 17 отменил медленный запрос
  expectObservable(results).toBe('-------------------r-----|', { r: 'результаты «улун»' });
});

// --- рывок: combineLatest видит промежуточное несогласованное состояние ---
const a$ = new BehaviorSubject(1);
const pairs = [];
combineLatest([a$.pipe(map((x) => x * 2)), a$.pipe(map((x) => x + 1))]).subscribe(([b, c]) => pairs.push([b, c]));
a$.next(2);
assert.deepEqual(pairs, [[2, 2], [4, 2], [4, 3]]);                                      // [4, 2] — рывок: такого a не бывает
// сигналы: вычисляемое значение пересчитывается один раз и согласованно
const a = signal(1);
const b = computed(() => a.value * 2);
const c = computed(() => a.value + 1);
const seenSignals = [];
effect(() => { seenSignals.push([b.value, c.value]); });
a.value = 2;
assert.deepEqual(seenSignals, [[2, 2], [4, 3]]);

// --- противодавление: потребитель тянет, производитель ждёт ---
let produced = 0;
async function* readings() { for (let i = 0; i < 1000; i++) { produced++; yield i; } }
let consumed = 0;
for await (const x of readings()) {
  consumed++;
  await new Promise((r) => setTimeout(r, 1));                                          // медленная обработка
  if (consumed === 5) break;
}
assert.deepEqual([produced, consumed], [5, 5]);                                           // лишнего не произведено
// push-поток не ждёт: of отдаёт всё сразу
let pushed = 0;
from(Array.from({ length: 1000 }, (_, i) => i)).subscribe(() => { pushed++; });
assert.equal(pushed, 1000);

console.log('streams ok');
