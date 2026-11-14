// Глава 7.01 — «Под капотом»: hidden classes (maps)
// flags: --allow-natives-syntax
// run: node --allow-natives-syntax hidden-classes.cjs

function Point(x, y) { this.x = x; this.y = y; }
const a = new Point(1, 2), b = new Point(3, 4);
const c = { y: 1, x: 2 };
console.log('a,b same map:', %HaveSameMap(a, b), '| a,c same map:', %HaveSameMap(a, c));
b.z = 5; console.log('after b.z, a,b same map:', %HaveSameMap(a, b));
const d = new Point(1, 2); delete d.x; console.log('delete first prop -> fast?', %HasFastProperties(d));
const e = new Point(1, 2); delete e.y; console.log('delete last prop -> fast?', %HasFastProperties(e));
