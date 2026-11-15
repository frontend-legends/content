// Проверки к 13.13: настоящий Docker — многоэтапная сборка, кеш слоёв, .dockerignore, nginx для SPA,
// конфигурация при запуске контейнера. Нужен запущенный Docker; образы fl-shop-* удаляются в конце.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { project, run, write } from '../../_lib/project.mjs';

if (run('docker', ['info']).status !== 0) {
  console.log('containers ok (пропущено: Docker не запущен)');
  process.exit(0);
}
const tags = [];
const containers = [];
process.on('exit', () => {
  for (const c of containers) run('docker', ['rm', '-f', c]);
  for (const t of tags) run('docker', ['rmi', '-f', t]);
});

const dockerfile = `# стадия 1: сборка
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# стадия 2: раздача
FROM nginx:1.29-alpine
ARG CONF=nginx.conf
COPY \${CONF} /etc/nginx/conf.d/default.conf
COPY 40-config.sh /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
`;
// «сборщик» без зависимостей: копирует src в dist и добавляет хеш к имени скрипта
const buildScript = `import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const js = readFileSync('src/main.js');
const name = 'main-' + createHash('sha256').update(js).digest('hex').slice(0, 8) + '.js';
mkdirSync('dist/assets', { recursive: true });
writeFileSync('dist/assets/' + name, js);
writeFileSync('dist/index.html', readFileSync('src/index.html', 'utf8').replace('MAIN', '/assets/' + name));
`;
const nginxConf = `server {
  listen 80;
  root /usr/share/nginx/html;
  location /assets/ { try_files $uri =404; add_header Cache-Control "public, max-age=31536000, immutable"; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  location / { try_files $uri $uri/ /index.html; }
}
`;
const naiveConf = `server {
  listen 80;
  root /usr/share/nginx/html;
  location / { try_files $uri $uri/ /index.html; }
}
`;
const configScript = `#!/bin/sh
# конфигурация при запуске: из переменных окружения контейнера
printf '{"apiUrl":"%s"}' "$API_URL" > /usr/share/nginx/html/config.json
`;
const dir = project({
  'package.json': JSON.stringify({ name: 'shop', version: '1.0.0', private: true, scripts: { build: 'node build.mjs' } }, null, 2),
  'package-lock.json': JSON.stringify({ name: 'shop', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'shop', version: '1.0.0' } } }, null, 2),
  'build.mjs': buildScript,
  'src/index.html': '<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module" src="MAIN"></script>',
  'src/main.js': "document.getElementById('app').textContent = 'Магазин';\n",
  'Dockerfile': dockerfile,
  'nginx.conf': nginxConf,
  'naive.conf': naiveConf,
  '40-config.sh': configScript,
}, { linkModules: false });
run('chmod', ['+x', join(dir, '40-config.sh')]);
// тяжёлая папка, которой не место в контексте сборки
mkdirSync(join(dir, 'node_modules/huge'), { recursive: true });
writeFileSync(join(dir, 'node_modules/huge/blob.bin'), Buffer.alloc(20 * 1024 * 1024));

const docker = (args, opts = {}) => {
  const r = run('docker', args, { cwd: dir, env: { DOCKER_BUILDKIT: '1', BUILDKIT_PROGRESS: 'plain' }, ...opts });
  assert.equal(r.status, 0, `docker ${args.join(' ')}\n${r.out}`);
  return r;
};
const build = (tag, extra = []) => { tags.push(tag); return docker(['build', '--progress=plain', '-t', tag, ...extra, '.']).out; };
const contextSize = (out) => { const m = out.match(/transferring context: ([\d.]+)(kB|MB|B)/g)?.at(-1)?.match(/([\d.]+)(kB|MB|B)/); return m ? Number(m[1]) * ({ B: 1 / 1024, kB: 1, MB: 1024 }[m[2]]) : 0; };

// --- .dockerignore: без него в контекст уходит node_modules ---
const noIgnore = build('fl-shop-web:noignore');
assert.ok(contextSize(noIgnore) > 15 * 1024, `context ${contextSize(noIgnore)} kB`);
write(dir, '.dockerignore', 'node_modules\n.git\ndist\n');
const first = build('fl-shop-web:test');
assert.ok(contextSize(first) < 1024, `context ${contextSize(first)} kB`);

// --- многоэтапная сборка: в итоговом образе нет Node.js, он в разы меньше стадии сборки ---
build('fl-shop-build:test', ['--target', 'build']);
const size = (tag) => Number(docker(['image', 'inspect', '--format', '{{.Size}}', tag]).stdout.trim());
const finalSize = size('fl-shop-web:test');
const buildSize = size('fl-shop-build:test');
assert.ok(finalSize * 2 < buildSize, `final ${finalSize} build ${buildSize}`);
assert.notEqual(run('docker', ['run', '--rm', '--entrypoint', 'sh', 'fl-shop-web:test', '-c', 'command -v node']).status, 0);
assert.equal(run('docker', ['run', '--rm', '--entrypoint', 'sh', 'fl-shop-build:test', '-c', 'command -v node']).status, 0);
console.log(`  образ сборки ${(buildSize / 1e6).toFixed(0)} МБ, итоговый ${(finalSize / 1e6).toFixed(0)} МБ`);

// --- кеш слоёв: правка кода не перезапускает npm ci, правка package.json — перезапускает ---
write(dir, 'src/main.js', "document.getElementById('app').textContent = 'Магазин 2';\n");
const codeChange = build('fl-shop-web:test');
assert.match(codeChange, /RUN npm ci\n#\d+ CACHED/);
const pkg = JSON.parse(run('cat', ['package.json'], { cwd: dir }).stdout);
pkg.description = `магазин ${process.pid}-${Date.now()}`; // кеш BuildKit живёт между прогонами — значение каждый раз новое
write(dir, 'package.json', JSON.stringify(pkg, null, 2));
const depsChange = build('fl-shop-web:test');
assert.doesNotMatch(depsChange, /RUN npm ci\n#\d+ CACHED/);

// --- nginx: маршруты SPA и честный 404 для ассетов; конфиг из переменных окружения ---
build('fl-shop-web:naive', ['--build-arg', 'CONF=naive.conf']);
async function start(tag, env = {}) {
  const name = `fl-shop-${Math.random().toString(36).slice(2, 8)}`;
  containers.push(name);
  docker(['run', '-d', '--name', name, '-p', '127.0.0.1::80', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), tag]);
  const port = docker(['port', name, '80']).stdout.trim().split(':').pop();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  return { base, stop: () => run('docker', ['rm', '-f', name]) };
}
const web = await start('fl-shop-web:test', { API_URL: 'https://api.shop.example' });
const route = await fetch(`${web.base}/products/7`);
assert.equal(route.status, 200);
assert.match(await route.text(), /<div id="app">/);
const missing = await fetch(`${web.base}/assets/main-old12345.js`);
assert.equal(missing.status, 404);
const html = await fetch(`${web.base}/index.html`);
assert.equal(html.headers.get('cache-control'), 'no-cache');
assert.deepEqual(await (await fetch(`${web.base}/config.json`)).json(), { apiUrl: 'https://api.shop.example' });
web.stop();

// тот же образ, другое окружение — другой конфиг
const staging = await start('fl-shop-web:test', { API_URL: 'https://api.staging.shop.example' });
assert.deepEqual(await (await fetch(`${staging.base}/config.json`)).json(), { apiUrl: 'https://api.staging.shop.example' });
staging.stop();

// наивный конфиг: отсутствующий скрипт получает index.html с 200
const naive = await start('fl-shop-web:naive');
const naiveMissing = await fetch(`${naive.base}/assets/main-old12345.js`);
assert.equal(naiveMissing.status, 200);
assert.match(naiveMissing.headers.get('content-type'), /text\/html/);
naive.stop();

console.log('containers ok');
