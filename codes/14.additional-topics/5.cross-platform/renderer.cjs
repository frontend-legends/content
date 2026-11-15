// Проверка к 14.05: React — ядро, а во что рисовать, решает рендерер. Свой рендерер на react-reconciler
// превращает <View> и <Text> в «нативные виды» — объекты, как React Native превращает их в UIView и android.view.View.
const assert = require('node:assert/strict');
const React = require('react');
const Reconciler = require('react-reconciler');
const { DefaultEventPriority, NoEventPriority, ConcurrentRoot } = require('react-reconciler/constants');

const log = [];
let priority = NoEventPriority;
const host = {
  supportsMutation: true, isPrimaryRenderer: false, noTimeout: -1,
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, supportsMicrotasks: true, scheduleMicrotask: queueMicrotask,
  getRootHostContext: () => ({}), getChildHostContext: (c) => c, getPublicInstance: (i) => i,
  prepareForCommit: () => null, resetAfterCommit: () => {}, preparePortalMount: () => {},
  shouldSetTextContent: () => false, clearContainer: (c) => { c.children = []; },
  createInstance(type, props) {
    if (!['View', 'Text', 'Pressable'].includes(type)) throw new Error(`Нет нативного компонента «${type}»`);
    const { children, ...rest } = props;
    log.push(`create ${type}`);
    return { type, props: rest, children: [] };
  },
  createTextInstance: (text) => ({ type: '#text', text }),
  appendInitialChild: (p, c) => p.children.push(c), appendChild: (p, c) => p.children.push(c), appendChildToContainer: (r, c) => r.children.push(c),
  insertBefore: (p, c, b) => p.children.splice(p.children.indexOf(b), 0, c), insertInContainerBefore: (r, c, b) => r.children.splice(r.children.indexOf(b), 0, c),
  removeChild: (p, c) => p.children.splice(p.children.indexOf(c), 1), removeChildFromContainer: (r, c) => r.children.splice(r.children.indexOf(c), 1),
  finalizeInitialChildren: () => false,
  commitUpdate(instance, type, oldProps, newProps) { const { children, ...rest } = newProps; instance.props = rest; log.push(`update ${type}`); },
  commitTextUpdate(text, old, next) { text.text = next; log.push(`text ${old} → ${next}`); },
  detachDeletedInstance: () => {},
  getCurrentUpdatePriority: () => priority, setCurrentUpdatePriority: (p) => { priority = p; },
  resolveUpdatePriority: () => priority || DefaultEventPriority,
  maySuspendCommit: () => false, preloadInstance: () => true, startSuspendingCommit: () => {}, suspendInstance: () => {}, waitForCommitToBeReady: () => null,
  NotPendingTransition: null, HostTransitionContext: React.createContext(null), resetFormInstance: () => {},
  requestPostPaintCallback: () => {}, shouldAttemptEagerTransition: () => false, trackSchedulerEvent: () => {},
  resolveEventType: () => null, resolveEventTimeStamp: () => -1.1, hideInstance: () => {}, unhideInstance: () => {},
  hideTextInstance: () => {}, unhideTextInstance: () => {},
};
const renderer = Reconciler(host);
const screen = { children: [] };
const errors = [];
const report = (e) => errors.push(e.message);
const root = renderer.createContainer(screen, ConcurrentRoot, null, false, null, '', report, report, report, null);
const render = (el) => { renderer.updateContainerSync(el, root, null, null); renderer.flushSyncWork(); };
const h = React.createElement;

// тот же React: компонент, состояние, хуки — а «теги» другие
let press;
function Cart() {
  const [count, setCount] = React.useState(0);
  press = () => setCount((n) => n + 1);
  return h('View', { style: { padding: 16 } },
    h('Text', null, `В корзине: ${count}`),
    h('Pressable', { onPress: press }, h('Text', null, 'Добавить')));
}

render(h(Cart));
const tree = (n) => (n.type === '#text' ? n.text : { [n.type]: n.children.map(tree) });
assert.deepEqual(screen.children.map(tree), [{ View: [{ Text: ['В корзине: 0'] }, { Pressable: [{ Text: ['Добавить'] }] }] }]);
assert.deepEqual(log.slice(0, 4).sort(), ['create Pressable', 'create Text', 'create Text', 'create View']);

// обновление состояния — точечное изменение нативного вида, а не пересоздание
(async () => {
  log.length = 0;
  press(); // как onPress от нативной кнопки
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(screen.children.map(tree), [{ View: [{ Text: ['В корзине: 1'] }, { Pressable: [{ Text: ['Добавить'] }] }] }]);
  assert.equal(log[0], 'text В корзине: 0 → В корзине: 1'); // текст изменён на месте
  assert.ok(!log.some((l) => l.startsWith('create')));      // ни одного нового вида
  assert.ok(log.includes('update View'));                   // новые пропсы приходят рендереру, сравнивать ли их — его дело
  // div в нативном рендерере не существует
  render(h('div', null, 'Привет'));
  assert.deepEqual(errors, ['Нет нативного компонента «div»']);
  console.log('renderer ok');
})();
