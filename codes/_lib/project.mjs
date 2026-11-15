// Временный проект для проверок инструментов: файлы на диске, node_modules — ссылкой на codes/node_modules.
// Подключение: import { project, read, list, run } from '../../_lib/project.mjs';
//
// project(files)        — создаёт папку с файлами { 'src/main.ts': '…' }, возвращает путь; удаляется при выходе;
// read(dir, path)       — содержимое файла;
// list(dir, sub)        — относительные пути всех файлов в подпапке;
// run(cmd, args, opts)  — запуск процесса: { status, stdout, stderr, out }.
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const codesDir = fileURLToPath(new URL('../', import.meta.url));
export const bin = (name) => join(codesDir, 'node_modules', '.bin', name);

const created = [];
process.on('exit', () => { for (const d of created) { try { rmSync(d, { recursive: true, force: true }); } catch {} } });

export function project(files, { linkModules = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fl-proj-'));
  created.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  if (linkModules) symlinkSync(join(codesDir, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

export const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
export const write = (dir, p, content) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), content); };

export function list(dir, sub = '.') {
  const root = join(dir, sub);
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else out.push(relative(root, p)); } };
  walk(root);
  return out.sort();
}

export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...opts.env } });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', out: (r.stdout ?? '') + (r.stderr ?? '') };
}

// Сколько стоит код в бандле: собрать точку входа Rolldown с минификацией, вернуть байты до и после gzip.
// cost("import { debounce } from 'lodash-es'; console.log(debounce);")
export async function cost(entryCode, { platform = 'browser' } = {}) {
  const { rolldown } = await import('rolldown');
  const { gzipSync } = await import('node:zlib');
  const dir = project({ 'entry.js': entryCode });
  const bundle = await rolldown({ input: join(dir, 'entry.js'), platform, logLevel: 'silent', cwd: dir });
  const { output } = await bundle.generate({ format: 'es', minify: true, codeSplitting: false });
  const code = output.filter((o) => o.type === 'chunk').map((c) => c.code).join('\n');
  return { min: Buffer.byteLength(code), gzip: gzipSync(code).length, code };
}
