// Глава 9.04 — «Модель хуков в 50 строк»: список ячеек на fiber, курсор, два диспетчера, очередь апдейтов.
// В тексте — та же модель без useRef; ниже — проверки того, что из неё следует.
// run: node model.cjs
const assert = require('node:assert/strict');

// ---- модель (как в тексте) ----
let fiber = null;        // компонент, который сейчас рендерится
let cursor = null;       // последняя пройденная ячейка
let dispatcher = null;   // в React — ReactSharedInternals.H

const useState = (initial) => resolve().useState(initial);
const useRef = (initial) => resolve().useRef(initial);
function resolve() {
  if (dispatcher === null) throw new Error('Invalid hook call');
  return dispatcher;
}

const onMount = {
  useState(initial) {
    const hook = nextHook(true);
    hook.memoizedState = typeof initial === 'function' ? initial() : initial;
    const owner = fiber;
    hook.queue = [];
    hook.dispatch = (action) => {      // создаётся один раз — поэтому стабильна
      hook.queue.push(action);         // значение не меняется сразу
      scheduleRender(owner);
    };
    return [hook.memoizedState, hook.dispatch];
  },
  useRef(initial) {
    return (nextHook(true).memoizedState = { current: initial });
  },
};

const onUpdate = {
  useState() {
    const hook = nextHook(false);
    for (const action of hook.queue) {   // очередь — по порядку
      hook.memoizedState = typeof action === 'function' ? action(hook.memoizedState) : action;
    }
    hook.queue = [];
    return [hook.memoizedState, hook.dispatch];
  },
  useRef() {
    return nextHook(false).memoizedState;
  },
};

function nextHook(mounting) {
  const next = cursor ? cursor.next : fiber.memoizedState;
  if (mounting) {
    const hook = { memoizedState: null, queue: null, next: null };
    if (cursor) cursor.next = hook; else fiber.memoizedState = hook;
    return (cursor = hook);
  }
  if (!next) throw new Error('Rendered more hooks than during the previous render.');
  return (cursor = next);
}

function render(f) {
  fiber = f;
  cursor = null;
  dispatcher = f.memoizedState === null ? onMount : onUpdate;
  try {
    return f.type(f.props);
  } finally {
    dispatcher = null;                  // вне рендера хуки не работают
    fiber = cursor = null;
  }
}

// ---- обвязка: планировщик, который рендерит по запросу ----
const pending = new Set();
function scheduleRender(f) { pending.add(f); }
function flush() { const out = []; for (const f of pending) { pending.delete(f); out.push(render(f)); } return out; }

// ---- проверки ----
let click;
const seen = { dispatch: new Set(), ref: new Set() };
function Counter() {
  const [n, setN] = useState(0);
  const ref = useRef('stable');
  seen.dispatch.add(setN);
  seen.ref.add(ref);
  click = () => { setN(n + 1); setN(n + 1); setN((x) => x + 1); };
  return `clicks: ${n}`;
}
const counter = { type: Counter, props: {}, memoizedState: null };
assert.equal(render(counter), 'clicks: 0');
click();
assert.deepEqual(flush(), ['clicks: 2']);          // три апдейта → один рендер, 1 → 1 → 2
assert.equal(seen.dispatch.size, 1);               // setN один и тот же на всех рендерах
assert.equal(seen.ref.size, 1);                    // и объект ref тоже
assert.throws(() => useState(0), /Invalid hook call/);

// хук в условии: на втором рендере ячейки «съезжают»
function Form({ show }) {
  const [name] = useState('Ann');
  if (show) useState('hidden');
  const [age] = useState(30);
  return `${name}, ${age}`;
}
const form = { type: Form, props: { show: true }, memoizedState: null };
assert.equal(render(form), 'Ann, 30');
form.props = { show: false };
assert.equal(render(form), 'Ann, hidden');         // age прочитал чужую ячейку
form.props = { show: true };
const fresh = { type: Form, props: { show: false }, memoizedState: null };
render(fresh);
fresh.props = { show: true };
assert.throws(() => render(fresh), /Rendered more hooks/);
console.log('модель: батчинг 0 → 2, стабильный setN и ref, съехавшая ячейка «Ann, hidden», Rendered more hooks');
