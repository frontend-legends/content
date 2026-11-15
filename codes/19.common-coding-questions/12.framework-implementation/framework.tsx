// Проверки к 19.12: мини-реализации частей фреймворков, сверенные с настоящими.
// Сигналы — с @preact/signals-core: исходная версия теряла внешний эффект при вложенном, не отписывалась от
// старых зависимостей и давала глитч на «ромбе». Реактивность Vue — с @vue/reactivity (глубина, запись того же
// значения). useState с нуля — слоты по порядку, set(null) больше не сбрасывает состояние, условный хук
// сдвигает слоты (настоящий React падает с ошибкой). Кастомные хуки и портал — на React 19. Мини-VDOM:
// исходный render ставил disabled при false, patch не обновлял атрибуты и падал при удалении детей.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createContext, useContext, useEffect, useRef, useState as useReactState } from 'react';
import { createPortal } from 'react-dom';
import { signal as pSignal, computed as pComputed, effect as pEffect } from '@preact/signals-core';
import { reactive as vueReactive, effect as vueEffect } from '@vue/reactivity';

const { errors } = require('../../_lib/react.cjs') as { errors: string[] };
const { render: rtlRender, renderHook, screen, fireEvent, act, cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');

// ===================== сигналы =====================
type Reaction = { notify: () => void; deps: Set<Set<Reaction>> };
let current: Reaction | null = null;               // кто сейчас читает
const queue = new Set<Reaction & { run: () => void }>();
let flushing = false;
function flush() {
  if (flushing) return;
  flushing = true;
  try { while (queue.size) { const [e] = queue; queue.delete(e); e.run(); } } finally { flushing = false; }
}
const track = (subs: Set<Reaction>) => { if (current) { subs.add(current); current.deps.add(subs); } };
const untrackAll = (r: Reaction) => { for (const dep of r.deps) dep.delete(r); r.deps.clear(); };

function signal<T>(initial: T) {
  let value = initial;
  const subs = new Set<Reaction>();
  const read = () => { track(subs); return value; };
  const write = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const r of [...subs]) r.notify();         // фаза 1: пометить зависимых
    flush();                                         // фаза 2: выполнить эффекты
  };
  return [read, write] as const;
}

function effect(fn: () => void) {
  const e = {
    deps: new Set<Set<Reaction>>(),
    notify: () => { queue.add(e); },                 // эффект не бежит сразу — встаёт в очередь
    run: () => {
      untrackAll(e);                                 // зависимости собираются заново на каждом запуске
      const prev = current; current = e;             // стек: вложенный эффект не сбрасывает внешний
      try { fn(); } finally { current = prev; }
    },
  };
  e.run();
  return () => untrackAll(e);                        // dispose
}

function computed<T>(fn: () => T) {
  let value: T;
  let dirty = true;
  const subs = new Set<Reaction>();
  const self: Reaction = {
    deps: new Set(),
    notify: () => { if (!dirty) { dirty = true; for (const r of [...subs]) r.notify(); } }, // помечаем, не считаем
  };
  return () => {
    track(subs);
    if (dirty) {                                     // ленивый пересчёт при чтении
      untrackAll(self);
      const prev = current; current = self;
      try { value = fn(); } finally { current = prev; }
      dirty = false;
    }
    return value;
  };
}

// --- исходная версия из текста ---
function original() {
  let currentEffect: (() => void) | null = null;
  function signal<T>(v: T) { const subs = new Set<() => void>(); return [() => { if (currentEffect) subs.add(currentEffect); return v; }, (n: T) => { if (n === v) return; v = n; [...subs].forEach((f) => f()); }] as const; }
  function effect(fn: () => void) { const run = () => { currentEffect = run; try { fn(); } finally { currentEffect = null; } }; run(); }
  function computed<T>(fn: () => T) { const [g, s] = signal<T>(undefined as T); effect(() => s(fn())); return g; }
  return { signal, effect, computed };
}

// ===================== реактивность в стиле Vue =====================
let activeEffect: (() => void) | null = null;
const targetMap = new WeakMap<object, Map<PropertyKey, Set<() => void>>>();
const proxies = new WeakMap<object, object>();
function vTrack(target: object, key: PropertyKey) {
  if (!activeEffect) return;
  let deps = targetMap.get(target);
  if (!deps) targetMap.set(target, (deps = new Map()));
  let dep = deps.get(key);
  if (!dep) deps.set(key, (dep = new Set()));
  dep.add(activeEffect);
}
function vTrigger(target: object, key: PropertyKey) {
  const dep = targetMap.get(target)?.get(key);
  if (dep) for (const fn of [...dep]) fn();
}
function reactive<T extends object>(obj: T): T {
  const existing = proxies.get(obj);
  if (existing) return existing as T;              // один прокси на объект
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      vTrack(target, key);
      const value = Reflect.get(target, key, receiver);
      return value !== null && typeof value === 'object' ? reactive(value) : value; // глубина — лениво
    },
    set(target, key, value, receiver) {
      const old = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);
      if (!Object.is(old, value)) vTrigger(target, key);  // то же значение — без уведомления
      return result;
    },
  });
  proxies.set(obj, proxy);
  return proxy;
}
function watchEffect(fn: () => void) {
  const run = () => { const prev = activeEffect; activeEffect = run; try { fn(); } finally { activeEffect = prev; } };
  run();
}
class RefImpl<T> {
  private _value: T;
  private dep = new Set<() => void>();
  constructor(value: T) { this._value = value; }
  get value() { if (activeEffect) this.dep.add(activeEffect); return this._value; }
  set value(next: T) { if (Object.is(next, this._value)) return; this._value = next; for (const fn of [...this.dep]) fn(); }
}
const ref = <T,>(value: T) => new RefImpl(value);

// ===================== useState с нуля =====================
function createHooksRuntime(Component: () => unknown) {
  const hooks: unknown[] = [];
  let index = 0;
  let pendingEffects: (() => void)[] = [];
  const runtime = {
    output: undefined as unknown,
    useState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void] {
      const i = index++;
      if (!(i in hooks)) hooks[i] = initial;           // слот занят — даже если в нём null
      const setState = (next: T | ((prev: T) => T)) => {
        hooks[i] = typeof next === 'function' ? (next as (p: T) => T)(hooks[i] as T) : next;
        runtime.render();
      };
      return [hooks[i] as T, setState];
    },
    useEffect(fn: () => void | (() => void), deps: unknown[]) {
      const i = index++;
      const prev = hooks[i] as { deps: unknown[]; cleanup?: void | (() => void) } | undefined;
      const changed = !prev || deps.some((d, j) => !Object.is(d, prev.deps[j]));
      if (changed) pendingEffects.push(() => { prev?.cleanup?.(); hooks[i] = { deps, cleanup: fn() }; }); // после рендера
    },
    render() {
      index = 0;
      runtime.output = Component();
      const effects = pendingEffects; pendingEffects = [];
      effects.forEach((run) => run());
    },
  };
  return runtime;
}

// ===================== мини-VDOM =====================
type VNode = { type: string; props: Record<string, any>; children: (VNode | string)[] };
const h = (type: string, props: Record<string, any> | null = {}, ...children: any[]): VNode => ({ type, props: props ?? {}, children: children.flat().filter((c) => c != null && c !== false).map((c) => (typeof c === 'number' ? String(c) : c)) });

function setProp(el: HTMLElement, key: string, value: any, old?: any) {
  if (key.startsWith('on')) {
    const name = key.slice(2).toLowerCase();
    if (old) el.removeEventListener(name, old);
    if (value) el.addEventListener(name, value);
  } else if (key === 'value' || key === 'checked') (el as any)[key] = value; // свойство, а не атрибут
  else if (value === false || value == null) el.removeAttribute(key);        // false — нет атрибута
  else el.setAttribute(key, value === true ? '' : String(value));
}
function renderVNode(vnode: VNode | string): Node {
  if (typeof vnode === 'string') return document.createTextNode(vnode);
  const el = document.createElement(vnode.type);
  for (const [key, value] of Object.entries(vnode.props)) setProp(el, key, value);
  vnode.children.forEach((child) => el.appendChild(renderVNode(child)));
  return el;
}
const changed = (a: VNode | string, b: VNode | string) =>
  typeof a !== typeof b || (typeof a === 'string' && a !== b) || (typeof a !== 'string' && a.type !== (b as VNode).type);
function patch(parent: Node, oldV: VNode | string | undefined, newV: VNode | string | undefined, index = 0) {
  const existing = parent.childNodes[index];
  if (oldV === undefined) { parent.appendChild(renderVNode(newV!)); return; }
  if (newV === undefined) { parent.removeChild(existing); return; }
  if (changed(oldV, newV)) { parent.replaceChild(renderVNode(newV), existing); return; }
  if (typeof newV === 'string') return;
  const o = oldV as VNode, el = existing as HTMLElement;
  for (const key of new Set([...Object.keys(o.props), ...Object.keys(newV.props)])) {
    if (o.props[key] !== newV.props[key]) setProp(el, key, newV.props[key], o.props[key]); // обновляем атрибуты и слушатели
  }
  const common = Math.min(o.children.length, newV.children.length);
  for (let i = 0; i < common; i++) patch(el, o.children[i], newV.children[i], i);
  for (let i = common; i < newV.children.length; i++) patch(el, undefined, newV.children[i], i);
  for (let i = o.children.length - 1; i >= newV.children.length; i--) patch(el, o.children[i], undefined, i); // удаляем с конца
}

async function main() {
  // ---------- сигналы: исходная версия ----------
  {
    const o = original();
    const [a, setA] = o.signal(1), [b] = o.signal(10);
    let outer = 0;
    o.effect(() => { outer++; o.effect(() => { b(); }); a(); }); // вложенный эффект сбрасывает currentEffect в null
    setA(2);
    assert.equal(outer, 1);                         // внешний эффект не перезапустился — подписка на a потеряна
    const [x, setX] = o.signal(1);
    const dbl = o.computed(() => x() * 2), tri = o.computed(() => x() * 3);
    const seen: string[] = [];
    o.effect(() => seen.push(`${dbl()}+${tri()}`));
    setX(2);
    assert.deepEqual(seen, ['2+3', '4+3', '4+6']);  // глитч: промежуточное несогласованное 4+3
  }
  // ---------- сигналы: исправленная версия против Preact ----------
  {
    const [a, setA] = signal(1), [b] = signal(10);
    let outer = 0;
    effect(() => { outer++; effect(() => { b(); }); a(); });
    setA(2);
    assert.equal(outer, 2);                         // вложенный эффект не мешает внешнему
  }
  {
    const run = (s: typeof signal, c: typeof computed, e: typeof effect) => {
      const [x, setX] = s(1);
      const dbl = c(() => x() * 2), tri = c(() => x() * 3);
      const seen: string[] = [];
      e(() => { seen.push(`${dbl()}+${tri()}`); });
      setX(2);
      return seen;
    };
    const preact = (() => {
      const x = pSignal(1); const dbl = pComputed(() => x.value * 2), tri = pComputed(() => x.value * 3);
      const seen: string[] = []; pEffect(() => { seen.push(`${dbl.value}+${tri.value}`); }); x.value = 2; return seen;
    })();
    assert.deepEqual(run(signal, computed, effect), ['2+3', '4+6']); // без промежуточного 4+3
    assert.deepEqual(preact, ['2+3', '4+6']);                         // как в @preact/signals-core
  }
  {
    // зависимости собираются заново: после смены ветки старая ветка больше не будит эффект
    const [flag, setFlag] = signal(true), [a, setA] = signal('a'), [b, setB] = signal('b');
    const seen: string[] = [];
    const dispose = effect(() => { seen.push(flag() ? a() : b()); });
    setFlag(false);                                 // теперь читается b
    setA('a2');                                     // a больше не зависимость — без перезапуска
    setB('b2');
    assert.deepEqual(seen, ['a', 'b', 'b2']);
    dispose();
    setB('b3');
    assert.deepEqual(seen, ['a', 'b', 'b2']);       // после dispose — тишина
    const [n, setN] = signal(NaN); let runs = 0;
    effect(() => { n(); runs++; }); setN(NaN);
    assert.equal(runs, 1);                          // Object.is: NaN — не изменение
  }

  // ---------- реактивность в стиле Vue против @vue/reactivity ----------
  {
    const scenario = (make: <T extends object>(o: T) => T, watch: (fn: () => void) => void) => {
      const state = make({ user: { name: 'Анна' }, count: 1 });
      const seen: string[] = [];
      watch(() => { seen.push(`${state.user.name}:${state.count}`); });
      state.user.name = 'Борис';                    // вложенное поле
      state.count = 1;                              // то же значение
      state.count = 2;
      return seen;
    };
    const ours = scenario(reactive, watchEffect);
    const vue = scenario(vueReactive as <T extends object>(o: T) => T, (fn) => { vueEffect(fn); });
    assert.deepEqual(ours, vue);
    assert.deepEqual(ours, ['Анна:1', 'Борис:1', 'Борис:2']); // глубина есть, повтор значения не уведомляет
    // добавление нового ключа: Vue перехватывает ownKeys, наша версия — нет
    const keysOurs = reactive<Record<string, number>>({ a: 1 }); let oursRuns = 0;
    watchEffect(() => { oursRuns++; Object.keys(keysOurs); }); keysOurs.b = 2;
    const keysVue = vueReactive<Record<string, number>>({ a: 1 }); let vueRuns = 0;
    vueEffect(() => { vueRuns++; Object.keys(keysVue); }); keysVue.b = 2;
    assert.deepEqual([oursRuns, vueRuns], [1, 2]);
    // ref: примитив нельзя проксировать — значение живёт в объекте за .value
    const count = ref(0); const seen: number[] = [];
    watchEffect(() => { seen.push(count.value); }); count.value = 1; count.value = 1;
    assert.deepEqual(seen, [0, 1]);
    assert.throws(() => new Proxy(0 as unknown as object, {}), TypeError); // Proxy над примитивом — ошибка
  }

  // ---------- useState с нуля ----------
  {
    let rt!: ReturnType<typeof createHooksRuntime>;
    let setName!: (v: string | null) => void;
    rt = createHooksRuntime(() => {
      const [name, set] = rt.useState<string | null>('Анна');
      setName = set;
      return name;
    });
    rt.render();
    setName(null);
    assert.equal(rt.output, null);                 // исходный hooks[i] ?? initial вернул бы 'Анна'
    const originalSlot = (slot: unknown, initial: unknown) => slot ?? initial;
    assert.equal(originalSlot(null, 'Анна'), 'Анна');
  }
  {
    // функциональное обновление и эффекты после рендера с очисткой
    let rt!: ReturnType<typeof createHooksRuntime>;
    let inc!: () => void;
    const log: string[] = [];
    rt = createHooksRuntime(() => {
      const [n, setN] = rt.useState(0);
      inc = () => { setN((p) => p + 1); setN((p) => p + 1); };
      rt.useEffect(() => { log.push(`эффект ${n}`); return () => log.push(`очистка ${n}`); }, [n]);
      log.push(`рендер ${n}`);
      return n;
    });
    rt.render();
    inc();
    assert.equal(rt.output, 2);                     // оба обновления учтены
    assert.deepEqual(log, ['рендер 0', 'эффект 0', 'рендер 1', 'очистка 0', 'эффект 1', 'рендер 2', 'очистка 1', 'эффект 2']); // эффект — после рендера, очистка — перед следующим
  }
  {
    // условный хук: слоты съезжают — состояние «чужого» хука
    let rt!: ReturnType<typeof createHooksRuntime>;
    let showGreeting = true;
    rt = createHooksRuntime(() => {
      const [greeting] = showGreeting ? rt.useState('привет') : ['—'];
      const [city] = rt.useState('Москва');
      return `${greeting}, ${city}`;
    });
    rt.render();
    assert.equal(rt.output, 'привет, Москва');
    showGreeting = false; rt.render();
    assert.equal(rt.output, '—, привет');            // city прочитал слот 0 — состояние greeting
  }
  {
    // настоящий React обнаруживает изменение числа хуков и падает
    function Conditional({ on }: { on: boolean }) {
      const [a] = on ? useReactState('привет') : ['—'];
      const [b] = useReactState('Москва');
      return <p>{a}, {b}</p>;
    }
    const { rerender } = rtlRender(<Conditional on={true} />);
    errors.length = 0;
    let thrown = '';
    try { rerender(<Conditional on={false} />); } catch (e: any) { thrown = e.message; }
    assert.match(thrown + errors.join(' '), /Rendered fewer hooks than expected/);
    cleanup();
  }

  // ---------- кастомные хуки на React ----------
  {
    function useDebounce<T>(value: T, delay = 300): T {
      const [debounced, setDebounced] = useReactState(value);
      useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
      }, [value, delay]);
      return debounced;
    }
    function usePrevious<T>(value: T): T | undefined {
      const ref = useRef<T | undefined>(undefined);  // в типах React 19 аргумент useRef обязателен
      useEffect(() => { ref.current = value; }, [value]);
      return ref.current;
    }
    mock.timers.enable({ apis: ['setTimeout'] });
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'ч' } });
    rerender({ v: 'ча' }); rerender({ v: 'чай' });
    act(() => { mock.timers.tick(299); });
    assert.equal(result.current, 'ч');             // пока вводят — старое значение
    act(() => { mock.timers.tick(1); });
    assert.equal(result.current, 'чай');
    mock.timers.reset();
    const prev = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 1 } });
    assert.equal(prev.result.current, undefined);
    prev.rerender({ v: 2 });
    assert.equal(prev.result.current, 1);          // значение прошлого рендера
    prev.rerender({ v: 3 });
    assert.equal(prev.result.current, 2);
    cleanup();
  }

  // ---------- портал: физически в body, логически в дереве React ----------
  {
    const Theme = createContext('светлая');
    const reactClicks: string[] = [], domClicks: string[] = [];
    function Child() { return <button>в портале: {useContext(Theme)}</button>; }
    function App() {
      const box = useRef<HTMLDivElement>(null);
      useEffect(() => { box.current!.addEventListener('click', () => domClicks.push('dom')); }, []);
      return (
        <Theme.Provider value="тёмная">
          <div ref={box} onClick={() => reactClicks.push('react')}>
            {createPortal(<Child />, document.body)}
          </div>
        </Theme.Provider>
      );
    }
    rtlRender(<App />);
    const btn = screen.getByText(/в портале/);
    assert.equal(btn.textContent, 'в портале: тёмная'); // контекст прошёл через портал
    assert.equal(btn.parentElement, document.body);     // а DOM-родитель — body
    fireEvent.click(btn);
    assert.deepEqual(reactClicks, ['react']);           // событие всплыло по дереву React
    assert.deepEqual(domClicks, []);                    // DOM-слушатель на div его не видел
    cleanup();
  }

  // ---------- мини-VDOM ----------
  {
    document.body.innerHTML = '<div id="app"></div>';
    const app = document.getElementById('app')!;
    const btnOriginal = document.createElement('button');
    btnOriginal.setAttribute('disabled', String(false));  // исходный render: setAttribute для любого значения
    assert.equal((btnOriginal as HTMLButtonElement).disabled, true); // атрибут есть — кнопка неактивна
    const clicked: string[] = [];
    const v1 = h('ul', { class: 'a' }, h('li', null, '1'), h('li', null, '2'), h('li', null, '3'), h('button', { disabled: false, onClick: () => clicked.push('v1') }, 'ок'));
    app.appendChild(renderVNode(v1));
    const btn = app.querySelector('button')!;
    assert.equal(btn.disabled, false);
    const v2 = h('ul', { class: 'b' }, h('li', null, '1'), h('button', { disabled: true, onClick: () => clicked.push('v2') }, 'ок'));
    patch(app, v1, v2);
    assert.equal(app.firstElementChild!.getAttribute('class'), 'b'); // атрибуты обновлены
    assert.equal(app.querySelectorAll('li').length, 1);              // лишние дети удалены без ошибки
    const btn2 = app.querySelector('button')!;
    assert.equal(btn2.disabled, true);
    const v3 = h('ul', { class: 'b' }, h('li', null, '1'), h('button', { disabled: false, onClick: () => clicked.push('v3') }, 'ок'));
    patch(app, v2, v3);
    (app.querySelector('button') as HTMLButtonElement).click();
    assert.deepEqual(clicked, ['v3']);                               // старый слушатель снят, новый поставлен
    const li = app.querySelector('li');
    patch(app, v3, h('ul', { class: 'b' }, h('li', null, 'один'), h('button', { disabled: false }, 'ок')));
    assert.equal(app.querySelector('li'), li);                       // тот же DOM-узел — изменился только текст
    assert.equal(li!.textContent, 'один');
  }

  // ---------- мини-фреймворк: замена DOM теряет фокус, patch — нет ----------
  {
    const mount = (component: () => VNode, container: HTMLElement, mode: 'replace' | 'patch') => {
      let prev: VNode | undefined;
      effect(() => {
        const next = component();
        if (mode === 'replace') { container.innerHTML = ''; container.appendChild(renderVNode(next)); }
        else patch(container, prev, next);
        prev = next;
      });
    };
    for (const mode of ['replace', 'patch'] as const) {
      document.body.innerHTML = '<div id="app"></div>';
      const [text, setText] = signal('');
      mount(() => h('div', null, h('input', { value: text(), onInput: (e: Event) => setText((e.target as HTMLInputElement).value) }), h('p', null, `символов: ${text().length}`)), document.getElementById('app')!, mode);
      const input = () => document.querySelector('input')!;
      input().focus();
      input().value = 'ч';
      input().dispatchEvent(new window.Event('input'));
      assert.equal(document.querySelector('p')!.textContent, 'символов: 1');
      if (mode === 'replace') assert.notEqual(document.activeElement, input()); // поле пересоздано — фокус потерян
      else assert.equal(document.activeElement, input());                      // тот же узел — фокус на месте
    }
  }

  console.log('framework ok');
}
main().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
