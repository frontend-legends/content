// Проверки к 19.11 на настоящем React 19 в jsdom: автокомплит (дебаунс, гонка, очистка поля — исходный
// показывал устаревшие подсказки, клавиатура и ARIA), бесконечный список с управляемым IntersectionObserver
// (исходный грузил страницу дважды и не останавливался в конце), пагинация (0 страниц и многоточие вместо
// одной страницы), todo как чистые функции, крестики-нолики (все линии, ничья, ход в занятую клетку).
import assert from 'node:assert/strict';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

require('../../_lib/react.cjs');
const { render, screen, fireEvent, act, cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (ms: number) => act(() => sleep(ms));
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

// --- автокомплит: исходная версия ---
function AutocompleteOriginal({ fetchSuggestions, delay = 300 }: { fetchSuggestions: (q: string) => Promise<string[]>; delay?: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const lastQuery = useRef('');
  useEffect(() => {
    if (!query) { setResults([]); return; }
    const id = setTimeout(async () => {
      lastQuery.current = query;
      const data = await fetchSuggestions(query);
      if (lastQuery.current === query) setResults(data);  // после очистки поля lastQuery остаётся прежним
    }, delay);
    return () => clearTimeout(id);
  }, [query, fetchSuggestions, delay]);
  return <div><input value={query} onChange={(e) => setQuery(e.target.value)} /><ul>{results.map((r) => <li key={r}>{r}</li>)}</ul></div>;
}

// --- автокомплит: исправленный ---
function Autocomplete({ fetchSuggestions, delay = 300 }: { fetchSuggestions: (q: string, signal: AbortSignal) => Promise<string[]>; delay?: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const chosen = useRef<string | null>(null);              // выбранное значение не ищем заново
  const listId = useId();
  useEffect(() => {
    if (!query.trim() || query === chosen.current) { setResults([]); setStatus('idle'); return; }
    let ignore = false;                                     // ответ этого эффекта устарел после cleanup
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setStatus('loading');
      try {
        const data = await fetchSuggestions(query, controller.signal);
        if (!ignore) { setResults(data); setActive(-1); setStatus('idle'); }
      } catch (e) {
        if (!ignore && (e as Error).name !== 'AbortError') setStatus('error');
      }
    }, delay);
    return () => { ignore = true; clearTimeout(id); controller.abort(); };
  }, [query, fetchSuggestions, delay]);
  const choose = (value: string) => { chosen.current = value; setQuery(value); setResults([]); setActive(-1); };
  const open = results.length > 0;
  return (
    <div>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => { chosen.current = null; setQuery(e.target.value); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]); }
          else if (e.key === 'Escape') { setResults([]); setActive(-1); }
        }}
      />
      {status === 'error' && <p role="alert">Не удалось загрузить подсказки</p>}
      <ul role="listbox" id={listId}>
        {results.map((r, i) => (
          <li key={r} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(r); }}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

// --- управляемый IntersectionObserver: jsdom его не реализует ---
class FakeIO {
  static all: FakeIO[] = [];
  el: Element | null = null;
  disconnected = false;
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) { FakeIO.all.push(this); }
  observe(el: Element) { this.el = el; }
  disconnect() { this.disconnected = true; }
  static fire() { for (const io of FakeIO.all) if (!io.disconnected && io.el?.isConnected) io.cb([{ isIntersecting: true }]); }
}
(globalThis as any).IntersectionObserver = FakeIO;

type Item = { id: number; title: string };
type Page = { items: Item[]; hasMore: boolean };

function InfiniteListOriginal({ loadMore }: { loadMore: () => Promise<Item[]> }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting && !loading) {               // loading из замыкания — устаревший
        setLoading(true);
        const next = await loadMore();
        setItems((prev) => [...prev, ...next]);
        setLoading(false);
      }
    });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore, loading]);
  return <div>{items.map((i) => <div key={i.id}>{i.title}</div>)}<div ref={sentinel} /></div>;
}

function InfiniteList({ loadPage }: { loadPage: (page: number) => Promise<Page> }) {
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const loading = useRef(false);                            // ref читается синхронно, без устаревшего замыкания
  const page = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setError(false);
    try {
      const { items: next, hasMore: more } = await loadPage(page.current);
      page.current += 1;
      setItems((prev) => [...prev, ...next]);
      setHasMore(more);
    } catch {
      setError(true);                                       // и ошибка не оставляет loading навсегда
    } finally {
      loading.current = false;
    }
  }, [loadPage]);
  useEffect(() => {
    if (!hasMore || error || !sentinel.current) return;     // в конце списка наблюдатель не нужен
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, error]);
  return (
    <div>
      {items.map((i) => <div key={i.id}>{i.title}</div>)}
      {error && <button onClick={loadMore}>Повторить</button>}
      {hasMore ? <div ref={sentinel} data-testid="sentinel" /> : <p>Это всё</p>}
    </div>
  );
}

// --- пагинация ---
function getPaginationRange(current: number, total: number, siblings = 1): (number | '...')[] {
  if (total <= 0) return [];                                // нет страниц — нет кнопок
  const range: (number | '...')[] = [1];
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);
  if (left === 3) range.push(2);                            // многоточие вместо одной страницы бессмысленно
  else if (left > 3) range.push('...');
  for (let i = left; i <= right; i++) range.push(i);
  if (right === total - 2) range.push(total - 1);
  else if (right < total - 2) range.push('...');
  if (total > 1) range.push(total);
  return range;
}

// --- todo как чистые функции над состоянием ---
type Todo = { id: string; text: string; done: boolean };
type Filter = 'all' | 'active' | 'done';
const addTodo = (todos: Todo[], text: string): Todo[] => (text.trim() ? [...todos, { id: crypto.randomUUID(), text: text.trim(), done: false }] : todos);
const toggleTodo = (todos: Todo[], id: string) => todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
const removeTodo = (todos: Todo[], id: string) => todos.filter((t) => t.id !== id);
const visibleTodos = (todos: Todo[], filter: Filter) => todos.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done));

// --- крестики-нолики ---
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
type Cell = 'X' | 'O' | null;
function getWinner(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}
function play(board: Cell[], index: number): Cell[] {
  if (board[index] || getWinner(board)) return board;       // занято или игра окончена — ход игнорируется
  const xs = board.filter((c) => c === 'X').length, os = board.filter((c) => c === 'O').length;
  const next = [...board];
  next[index] = xs === os ? 'X' : 'O';                      // чей ход — выводится из доски, не хранится отдельно
  return next;
}
const isDraw = (board: Cell[]) => board.every(Boolean) && !getWinner(board);

async function main() {
  // --- автокомплит: исходная версия показывает подсказки для стёртого запроса ---
  {
    const pending = deferred<string[]>();
    render(<AutocompleteOriginal delay={5} fetchSuggestions={() => pending.promise} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ч' } });
    await wait(20);                                         // запрос ушёл
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } }); // пользователь стёр ввод
    await act(async () => { pending.resolve(['чай', 'чайник']); await sleep(5); });
    assert.equal(screen.getAllByRole('listitem').length, 2); // поле пустое, а подсказки показаны
    cleanup();
  }
  // --- исправленный: дебаунс, гонка, очистка, ошибка ---
  {
    const calls: string[] = [];
    const replies: Record<string, ReturnType<typeof deferred<string[]>>> = {};
    const fetchSuggestions = (q: string) => { calls.push(q); replies[q] = deferred<string[]>(); return replies[q].promise; };
    render(<Autocomplete delay={10} fetchSuggestions={fetchSuggestions} />);
    const input = screen.getByRole('combobox');
    for (const v of ['ч', 'ча', 'чай']) fireEvent.change(input, { target: { value: v } });
    await wait(30);
    assert.deepEqual(calls, ['чай']);                       // дебаунс: один запрос на серию ввода
    fireEvent.change(input, { target: { value: 'чайн' } });
    await wait(30);
    await act(async () => { replies['чайн'].resolve(['чайник']); replies['чай'].resolve(['чай', 'чайник', 'чайный гриб']); await sleep(5); });
    assert.deepEqual(screen.getAllByRole('option').map((o) => o.textContent), ['чайник']); // старый ответ пришёл позже и проигнорирован
    fireEvent.change(input, { target: { value: 'к' } });
    await wait(30);
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => { replies['к'].resolve(['кофе']); await sleep(5); });
    assert.equal(screen.queryAllByRole('option').length, 0); // очистили поле — ответ на «к» не показан
    cleanup();
  }
  // --- клавиатура и ARIA: стрелки по кругу, Enter выбирает без нового запроса, Escape закрывает ---
  {
    const calls: string[] = [];
    render(<Autocomplete delay={5} fetchSuggestions={async (q) => { calls.push(q); return ['Москва', 'Мурманск']; }} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'М' } });
    await wait(30);
    assert.equal(input.getAttribute('aria-expanded'), 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });         // по кругу на первый
    const options = screen.getAllByRole('option');
    assert.equal(input.getAttribute('aria-activedescendant'), options[0].id);
    assert.equal(options[0].getAttribute('aria-selected'), 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    await wait(30);
    assert.equal((input as HTMLInputElement).value, 'Москва');
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(calls, ['М']);                         // выбор не запустил поиск по «Москва»
    fireEvent.change(input, { target: { value: 'Мур' } });
    await wait(30);
    fireEvent.keyDown(input, { key: 'Escape' });
    assert.equal(screen.queryAllByRole('option').length, 0);
    cleanup();
    render(<Autocomplete delay={5} fetchSuggestions={async () => { throw new Error('500'); }} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'x' } });
    await wait(30);
    assert.equal(screen.getByRole('alert').textContent, 'Не удалось загрузить подсказки');
    cleanup();
  }

  // --- бесконечный список: исходный грузит страницу дважды ---
  {
    FakeIO.all = [];
    let calls = 0;
    const first = deferred<Item[]>();
    render(<InfiniteListOriginal loadMore={() => { calls++; return first.promise; }} />);
    act(() => { FakeIO.fire(); FakeIO.fire(); });           // два пересечения до перерисовки
    assert.equal(calls, 2);                                 // loading в замыкании ещё false — двойная загрузка
    cleanup();
  }
  {
    FakeIO.all = [];
    const requested: number[] = [];
    let failNext = false;
    const loadPage = async (page: number): Promise<Page> => {
      requested.push(page);
      if (failNext) { failNext = false; throw new Error('сеть'); }
      return { items: [{ id: page * 2, title: `пост ${page * 2}` }, { id: page * 2 + 1, title: `пост ${page * 2 + 1}` }], hasMore: page < 1 };
    };
    render(<InfiniteList loadPage={loadPage} />);
    await act(async () => { FakeIO.fire(); FakeIO.fire(); await sleep(5); });
    assert.deepEqual(requested, [0]);                       // второе пересечение во время загрузки проигнорировано
    failNext = true;
    await act(async () => { FakeIO.fire(); await sleep(5); });
    assert.ok(screen.getByText('Повторить'));               // ошибка не заблокировала список навсегда
    await act(async () => { fireEvent.click(screen.getByText('Повторить')); await sleep(5); });
    assert.equal(screen.getByText('Это всё').tagName, 'P'); // вторая страница последняя — конец списка
    assert.deepEqual(requested, [0, 1, 1]);
    assert.equal(screen.getAllByText(/пост/).length, 4);
    await act(async () => { FakeIO.fire(); await sleep(5); });
    assert.deepEqual(requested, [0, 1, 1]);                 // после конца запросов больше нет
    cleanup();
  }

  // --- пагинация ---
  assert.deepEqual(getPaginationRange(5, 20), [1, '...', 4, 5, 6, '...', 20]);
  assert.deepEqual(getPaginationRange(1, 20), [1, 2, '...', 20]);
  assert.deepEqual(getPaginationRange(20, 20), [1, '...', 19, 20]);
  assert.deepEqual(getPaginationRange(4, 20), [1, 2, 3, 4, 5, '...', 20]); // страница 2 вместо многоточия
  assert.deepEqual(getPaginationRange(17, 20), [1, '...', 16, 17, 18, 19, 20]);
  assert.deepEqual(getPaginationRange(1, 1), [1]);
  assert.deepEqual(getPaginationRange(2, 3), [1, 2, 3]);
  assert.deepEqual(getPaginationRange(1, 0), []);           // пустой результат поиска — без кнопки «1»
  const originalRange = (current: number, total: number) => { const r: (number | '...')[] = []; const l = Math.max(2, current - 1), rr = Math.min(total - 1, current + 1); r.push(1); if (l > 2) r.push('...'); for (let i = l; i <= rr; i++) r.push(i); if (rr < total - 1) r.push('...'); if (total > 1) r.push(total); return r; };
  assert.deepEqual(originalRange(4, 20), [1, '...', 3, 4, 5, '...', 20]); // многоточие прячет одну страницу 2
  assert.deepEqual(originalRange(1, 0), [1]);               // и кнопка «1» при нуле страниц

  // --- todo ---
  let todos: Todo[] = [];
  todos = addTodo(todos, '  купить чай  ');
  todos = addTodo(todos, '   ');                            // пустую задачу не добавляем
  todos = addTodo(todos, 'позвонить');
  assert.deepEqual(todos.map((t) => t.text), ['купить чай', 'позвонить']);
  const before = todos;
  todos = toggleTodo(todos, todos[0].id);
  assert.notEqual(todos, before);                           // новый массив — React увидит изменение
  assert.equal(before[0].done, false);                      // старое состояние не мутировано
  assert.deepEqual(visibleTodos(todos, 'done').map((t) => t.text), ['купить чай']);
  assert.deepEqual(visibleTodos(todos, 'active').map((t) => t.text), ['позвонить']);
  todos = removeTodo(todos, todos[1].id);
  assert.equal(todos.length, 1);

  // --- крестики-нолики ---
  for (const line of LINES) {
    const board: Cell[] = Array(9).fill(null);
    for (const i of line) board[i] = 'O';
    assert.equal(getWinner(board), 'O');                    // каждая из восьми линий распознаётся
  }
  let board: Cell[] = Array(9).fill(null);
  for (const i of [0, 3, 1, 4]) board = play(board, i);
  assert.equal(play(board, 0), board);                      // занятая клетка — ход игнорируется
  board = play(board, 2);                                   // X: 0, 1, 2 — победа
  assert.equal(getWinner(board), 'X');
  assert.equal(play(board, 8), board);                      // после победы ходить нельзя
  let draw: Cell[] = Array(9).fill(null);
  for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) draw = play(draw, i);
  assert.equal(isDraw(draw), true);
  assert.equal(getWinner(draw), null);

  console.log('advanced ok');
}
main().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
