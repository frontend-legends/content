// Глава 7.01 — «Под капотом»: деоптимизация, из которой взят вывод в статье
// flags: --trace-opt --trace-deopt
// run: node --trace-opt --trace-deopt deopt.cjs

function add(a, b) { return a + b; }
for (let i = 0; i < 1e6; i++) add(i, 1);
add('a', 'b');
