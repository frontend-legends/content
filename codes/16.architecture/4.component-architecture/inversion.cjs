// Проверка к 16.04: инверсия управления. Хук количества отдаёт prop getters и принимает stateReducer —
// родитель меняет правило (максимум из остатка) и добавляет свой обработчик, не трогая компонент.
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');

const callAll = (...fns) => (...args) => fns.forEach((fn) => fn?.(...args));

function useQuantity({ initial = 1, stateReducer = (state, change) => change } = {}) {
  const [state, setState] = React.useState({ qty: initial });
  const dispatch = (type) => setState((s) => {
    const change = type === 'inc' ? { qty: s.qty + 1 } : { qty: Math.max(1, s.qty - 1) };
    return stateReducer(s, { ...change, type });
  });
  return {
    qty: state.qty,
    getIncrementProps: ({ onClick, ...rest } = {}) => ({ 'aria-label': 'Увеличить', onClick: callAll(onClick, () => dispatch('inc')), ...rest }),
    getDecrementProps: ({ onClick, ...rest } = {}) => ({ 'aria-label': 'Уменьшить', onClick: callAll(onClick, () => dispatch('dec')), ...rest }),
  };
}

// два разных интерфейса на одной логике
function Stepper({ stock, onAnyClick }) {
  const { qty, getIncrementProps, getDecrementProps } = useQuantity({
    stateReducer: (state, change) => (change.type === 'inc' && change.qty > stock ? state : change), // правило родителя
  });
  return h('div', null,
    h('button', getDecrementProps({ onClick: onAnyClick }), '−'),
    h('output', null, qty),
    h('button', getIncrementProps({ onClick: onAnyClick, className: 'plus' }), '+'));
}
function Compact() {
  const { qty, getIncrementProps } = useQuantity({ initial: 5 });
  return h('a', { href: '#', ...getIncrementProps() }, `ещё (${qty})`);
}

(async () => {
  const clicks = [];
  const { container } = await mount(h('div', null, h(Stepper, { stock: 3, onAnyClick: () => clicks.push('аналитика') }), h(Compact)));
  const plus = container.querySelector('button.plus');
  const out = () => container.querySelector('output').textContent;

  for (let i = 0; i < 5; i++) await React.act(async () => plus.click());
  assert.equal(out(), '3');                         // правило родителя: не больше остатка
  assert.equal(clicks.length, 5);                   // обработчик родителя вызван вместе со своим
  assert.equal(plus.getAttribute('aria-label'), 'Увеличить'); // доступность — от хука

  await React.act(async () => container.querySelector('a').click());
  assert.equal(container.querySelector('a').textContent, 'ещё (6)'); // другой интерфейс, та же логика, без ограничения
  console.log('inversion ok');
})();
