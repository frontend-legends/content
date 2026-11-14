// Общая обвязка для React-проверок: jsdom + React 19 dev + act. Подключение: const { React, h, mount, errors, fiberOf } = require("../../_lib/react.cjs");
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><title>t</title><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');

// console.error React копится здесь: проверки сверяют предупреждения
const errors = [];
console.error = (...a) => errors.push(a.map(String).join(' '));

async function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container, { onUncaughtError: (e) => errors.push('UNCAUGHT: ' + e.message) });
  await React.act(async () => root.render(el));
  return { root, container, render: (next) => React.act(async () => root.render(next)) };
}

// fiber компонента, который отрисовал DOM-узел: внутреннее поле, только для демонстрации
function fiberOf(node) {
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
  return node[key].return;
}

module.exports = { React, h: React.createElement, mount, errors, fiberOf };
