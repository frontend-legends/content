// Фикстура для compiler.cjs: настоящий вывод babel-plugin-react-compiler 1.0.0 (target: '19',
// @babel/preset-react classic) для SearchPage и SkippedPage из главы 9.11. Компилятор не стоит в codes/,
// поэтому вывод сохранён здесь. Правки только две: import → параметры фабрики и module.exports.
// SkippedPage компилятор пропустил (событие CompileError «This value cannot be modified») — вывод равен исходнику.
module.exports = function factory({ React, useState, Chart, ProductList, track }) {
  const { c: _c } = require('react/compiler-runtime');
  function SearchPage(t0) {
    const $ = _c(16);
    const {
      products
    } = t0;
    const [query, setQuery] = useState("");
    let t1;
    if ($[0] !== products || $[1] !== query) {
      let t2;
      if ($[3] !== query) {
        t2 = p => p.name.includes(query);
        $[3] = query;
        $[4] = t2;
      } else {
        t2 = $[4];
      }
      t1 = products.filter(t2);
      $[0] = products;
      $[1] = query;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    const visible = t1;
    let t2;
    if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = e => setQuery(e.target.value);
      $[5] = t2;
    } else {
      t2 = $[5];
    }
    let t3;
    if ($[6] !== query) {
      t3 = /*#__PURE__*/React.createElement("input", {
        value: query,
        onChange: t2
      });
      $[6] = query;
      $[7] = t3;
    } else {
      t3 = $[7];
    }
    let t4;
    if ($[8] !== products) {
      t4 = /*#__PURE__*/React.createElement(Chart, {
        data: products
      });
      $[8] = products;
      $[9] = t4;
    } else {
      t4 = $[9];
    }
    let t5;
    if ($[10] !== visible) {
      t5 = /*#__PURE__*/React.createElement(ProductList, {
        items: visible,
        onSelect: _temp
      });
      $[10] = visible;
      $[11] = t5;
    } else {
      t5 = $[11];
    }
    let t6;
    if ($[12] !== t3 || $[13] !== t4 || $[14] !== t5) {
      t6 = /*#__PURE__*/React.createElement("div", null, t3, t4, t5);
      $[12] = t3;
      $[13] = t4;
      $[14] = t5;
      $[15] = t6;
    } else {
      t6 = $[15];
    }
    return t6;
  }
  function _temp(id) {
    return track(id);
  }
  function SkippedPage({
    products
  }) {
    const [query, setQuery] = useState('');
    products.lastQuery = query; // мутация props — нарушение Rules of React
    const visible = products.filter(p => p.name.includes(query));
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
      value: query,
      onChange: e => setQuery(e.target.value)
    }), /*#__PURE__*/React.createElement(Chart, {
      data: products
    }), /*#__PURE__*/React.createElement(ProductList, {
      items: visible,
      onSelect: id => track(id)
    }));
  }
  return { SearchPage, SkippedPage };
};
