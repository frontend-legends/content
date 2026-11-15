// Проверки к 16.10, часть без браузера: автокомплит (дебаунс, гонка ответов, кеш, минимум символов),
// лента (offset против курсора при вставке и удалении), чат (оптимистичная отправка, дубли после переподключения, порядок).
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- автокомплит ---
// сервер: ответ на короткий запрос приходит дольше — так в жизни бывает с широкими запросами
const makeServer = () => {
  const calls = [];
  const search = (q, { signal } = {}) => new Promise((resolve, reject) => {
    calls.push(q);
    const t = setTimeout(() => resolve([`${q}: результат`]), q.length === 1 ? 120 : 30);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
  });
  return { calls, search };
};

function naiveAutocomplete(search) {
  const state = { shown: null };
  return { state, input: (q) => { search(q).then((r) => { state.shown = r; }); } };
}

function createAutocomplete(search, { debounce = 50, minLength = 2 } = {}) {
  const state = { shown: [], loading: false };
  const cache = new Map();
  let timer, controller;
  const input = (raw) => {
    const q = raw.trim().toLowerCase();
    clearTimeout(timer);
    controller?.abort();                       // ответ на прошлый запрос больше не нужен
    if (q.length < minLength) { state.shown = []; return; }
    if (cache.has(q)) { state.shown = cache.get(q); return; }
    timer = setTimeout(async () => {
      controller = new AbortController();
      state.loading = true;
      try {
        const r = await search(q, { signal: controller.signal });
        cache.set(q, r);
        state.shown = r;
        state.loading = false;
      } catch (e) {
        if (e.name !== 'AbortError') throw e;
      }
    }, debounce);
  };
  return { state, input };
}

// без защиты: быстрый набор «ч» → «ча», медленный ответ на «ч» приходит последним и затирает подсказки
{
  const s = makeServer();
  const ac = naiveAutocomplete(s.search);
  ac.input('ч'); await sleep(5); ac.input('ча');
  await sleep(200);
  assert.deepEqual(s.calls, ['ч', 'ча']);
  assert.deepEqual(ac.state.shown, ['ч: результат']); // на экране — подсказки к старому запросу
}

// с дебаунсом, отменой и кешем
{
  const s = makeServer();
  const ac = createAutocomplete(s.search, { debounce: 50, minLength: 1 });
  for (const q of ['ч', 'ча', 'чай', 'чай ', 'чай п']) { ac.input(q); await sleep(10); } // пять нажатий быстрее дебаунса
  await sleep(150);
  assert.deepEqual(s.calls, ['чай п']);                 // один запрос вместо пяти
  assert.deepEqual(ac.state.shown, ['чай п: результат']);

  // гонка: «ч» ушёл в сеть, пока он летит — новый ввод; старый запрос отменён
  ac.input('ч'); await sleep(70);                       // дебаунс прошёл, медленный запрос в полёте
  ac.input('чайник'); await sleep(150);
  assert.deepEqual(s.calls, ['чай п', 'ч', 'чайник']);
  assert.deepEqual(ac.state.shown, ['чайник: результат']);
  await sleep(100);
  assert.deepEqual(ac.state.shown, ['чайник: результат']); // ответ на «ч» так и не пришёл — он отменён

  // кеш: возврат к прошлому запросу без сети, регистр и пробелы нормализованы
  ac.input('ЧАЙ П ');
  assert.deepEqual(ac.state.shown, ['чай п: результат']);
  assert.equal(s.calls.length, 3);
}
// минимум символов: один символ при minLength 2 не уходит в сеть
{
  const s = makeServer();
  const ac = createAutocomplete(s.search);
  ac.input('ч'); await sleep(100);
  assert.deepEqual(s.calls, []);
  assert.deepEqual(ac.state.shown, []);
}

// --- лента: offset против курсора ---
const makeFeed = (n) => {
  let posts = Array.from({ length: n }, (_, i) => ({ id: n - i }));  // новые сверху: id 30, 29, …, 1
  return {
    publish: (id) => { posts = [{ id }, ...posts]; },
    remove: (id) => { posts = posts.filter((p) => p.id !== id); },
    byOffset: (offset, limit) => posts.slice(offset, offset + limit),
    byCursor: (cursor, limit) => {                 // курсор — id последнего показанного поста
      const start = cursor == null ? 0 : posts.findIndex((p) => p.id < cursor);
      const items = start < 0 ? [] : posts.slice(start, start + limit);
      return { items, nextCursor: items.length === limit ? items.at(-1).id : null };
    },
  };
};
const ids = (list) => list.map((p) => p.id);

// новый пост между первой и второй страницей
{
  const feed = makeFeed(30);
  const page1 = feed.byOffset(0, 10);
  feed.publish(31);
  const page2 = feed.byOffset(10, 10);
  assert.deepEqual(ids(page1).slice(-1), [21]);
  assert.deepEqual(ids(page2).slice(0, 2), [21, 20]);      // offset: пост 21 показан второй раз

  const feed2 = makeFeed(30);
  const c1 = feed2.byCursor(null, 10);
  feed2.publish(31);
  const c2 = feed2.byCursor(c1.nextCursor, 10);
  assert.deepEqual(ids(c2.items).slice(0, 1), [20]);       // курсор: продолжение ровно с места остановки
  assert.equal(new Set([...ids(c1.items), ...ids(c2.items)]).size, 20);
}
// удаление между страницами
{
  const feed = makeFeed(30);
  const page1 = feed.byOffset(0, 10);
  feed.remove(28);
  const page2 = feed.byOffset(10, 10);
  assert.deepEqual(ids(page2).slice(0, 1), [19]);          // offset: пост 20 не покажется никогда
  assert.ok(!ids(page1).includes(20) && !ids(page2).includes(20));

  const feed2 = makeFeed(30);
  const c1 = feed2.byCursor(null, 10);
  feed2.remove(28);
  assert.deepEqual(ids(feed2.byCursor(c1.nextCursor, 10).items).slice(0, 1), [20]);
}

// --- чат: состояние сообщений ---
// сообщения нормализованы по id; локальное получает clientId и статус «отправляется», ответ сервера его заменяет
function chatReducer(state, action) {
  switch (action.type) {
    case 'send': {
      const msg = { id: action.clientId, clientId: action.clientId, text: action.text, status: 'sending' };
      return { byId: { ...state.byId, [msg.id]: msg }, order: [...state.order, msg.id] };
    }
    case 'ack': {                                    // сервер подтвердил: присвоил id и порядковый номер
      const { [action.clientId]: local, ...rest } = state.byId;
      const msg = { ...local, id: action.id, seq: action.seq, status: 'sent' };
      return { byId: { ...rest, [msg.id]: msg }, order: state.order.map((id) => (id === action.clientId ? msg.id : id)) };
    }
    case 'fail':
      return { ...state, byId: { ...state.byId, [action.clientId]: { ...state.byId[action.clientId], status: 'failed' } } };
    case 'receive': {                                // из сокета или из истории — может прийти повторно
      const fresh = action.messages.filter((m) => !state.byId[m.id]);
      const byId = { ...state.byId, ...Object.fromEntries(fresh.map((m) => [m.id, { ...m, status: 'sent' }])) };
      const order = [...state.order, ...fresh.map((m) => m.id)]
        .sort((a, b) => (byId[a].seq ?? Infinity) - (byId[b].seq ?? Infinity)); // неподтверждённые — в конце
      return { byId, order };
    }
  }
}
{
  let s = { byId: {}, order: [] };
  s = chatReducer(s, { type: 'receive', messages: [{ id: 'm1', seq: 1, text: 'привет' }, { id: 'm2', seq: 2, text: 'как дела?' }] });
  s = chatReducer(s, { type: 'send', clientId: 'c1', text: 'отлично' });
  assert.equal(s.byId.c1.status, 'sending');               // показано сразу, до ответа сервера
  s = chatReducer(s, { type: 'receive', messages: [{ id: 'm4', seq: 4, text: 'а у тебя?' }] });
  assert.deepEqual(s.order, ['m1', 'm2', 'm4', 'c1']);     // своё неподтверждённое — внизу
  s = chatReducer(s, { type: 'ack', clientId: 'c1', id: 'm3', seq: 3 });
  s = chatReducer(s, { type: 'receive', messages: [{ id: 'm3', seq: 3, text: 'отлично' }] }); // эхо своего сообщения
  // переподключение: сервер присылает последние сообщения ещё раз
  s = chatReducer(s, { type: 'receive', messages: [{ id: 'm2', seq: 2, text: 'как дела?' }, { id: 'm3', seq: 3, text: 'отлично' }, { id: 'm4', seq: 4, text: 'а у тебя?' }] });
  assert.deepEqual(s.order, ['m1', 'm2', 'm3', 'm4']);     // ни одного дубля, порядок по серверу
  assert.equal(Object.keys(s.byId).length, 4);
  assert.equal(s.byId.m3.status, 'sent');

  s = chatReducer(s, { type: 'send', clientId: 'c2', text: 'алло' });
  s = chatReducer(s, { type: 'fail', clientId: 'c2' });
  assert.equal(s.byId.c2.status, 'failed');                // не пропало: видно «не отправлено, повторить»
  assert.equal(s.order.at(-1), 'c2');
}

console.log('logic ok');
