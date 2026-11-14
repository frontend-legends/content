// Глава 7.01 — «Под капотом»: полиморфный → мегаморфный inline cache (5 форм объекта)
// run: node --trace-ic inline-cache.cjs  (пишет лог в текущую папку; без флага просто выполняется)

function getX(p) { return p.x; }
const shapes = [{x:1},{x:1,a:1},{x:1,b:1},{x:1,c:1},{x:1,d:1}];
for (let i = 0; i < 1e5; i++) getX(shapes[i % 5]);
