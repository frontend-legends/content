// Глава 7.01 — «модули всегда strict»: this в ES-модуле
// run: node module-this.mjs

console.log("ESM this at top:", this); function f(){return this}; console.log("ESM f():", f())
