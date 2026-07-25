import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = process.cwd();
const out = join(root, 'code.txt');
const skipDirs = new Set(['node_modules', 'dist', '.git', '.vercel', '.cursor']);
const skipFiles = new Set(['code.txt']);
const allowExt = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.toml',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.bat',
  '.ps1',
  '.example',
  '.nvmrc',
]);
const allowNames = new Set(['.gitignore', '.oxlintrc.json', '.nvmrc']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, files);
      continue;
    }
    const rel = relative(root, p).replaceAll('\\', '/');
    if (skipFiles.has(name) || skipFiles.has(rel)) continue;
    const ext = extname(name).toLowerCase();
    if (!allowExt.has(ext) && !allowNames.has(name) && !name.endsWith('.example')) continue;
    files.push(p);
  }
  return files;
}

const files = walk(root).sort((a, b) => a.localeCompare(b));
const parts = [];
parts.push('ספין זוגי / Couple Spin — ייצוא קוד מלא');
parts.push('מקור: F:\\GAMED');
parts.push(`קבצים: ${files.length}`);
parts.push('='.repeat(72));

for (const p of files) {
  const rel = relative(root, p).replaceAll('\\', '/');
  let content = readFileSync(p, 'utf8');
  parts.push('');
  parts.push(`████ FILE: ${rel} ████`);
  parts.push('-'.repeat(72));
  parts.push(content.replace(/\r\n/g, '\n'));
}

writeFileSync(out, parts.join('\n'), 'utf8');
const size = statSync(out).size;
console.log(`Wrote ${out}`);
console.log(`Files: ${files.length}`);
console.log(`Size: ${(size / 1024).toFixed(1)} KB`);
