import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path';

// Read indexed, regular Git blobs. Local edits, symlinks and untracked files
// never supply bytes to the export, even if a working-tree path is replaced.
const root = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
const options = { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 };
const entries = execFileSync('git', ['ls-files', '--stage', '-z'], options).split('\0');
const files = [];
for (const entry of entries) {
  const match = /^(?:100644|100755) ([0-9a-f]+) 0\t([\s\S]+)$/.exec(entry);
  if (!match) continue;
  const [, oid, path] = match;
  const name = basename(path).toLowerCase();
  if (/(?:^|\/)secrets-vault\//i.test(path) || /^(?:\.env(?:\..*)?|code\.txt)$/.test(name) ||
      /service[-_]?account|firebase-adminsdk|credential|\.local(?:\.|$)/i.test(name)) continue;
  if (!['.gitignore', '.nvmrc'].includes(name) &&
      !/^\.(?:tsx?|jsx?|mjs|cjs|css|html|json|toml|ya?ml|md|txt|bat|ps1|rules)$/.test(extname(name))) continue;
  files.push({ oid, path });
}
// Ignore rules can change after a file was staged, or a file can be force-added.
const check = spawnSync('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
  ...options, input: files.map(({ path }) => path + '\0').join(''),
});
if (check.error || ![0, 1].includes(check.status)) throw new Error('Could not evaluate Git ignore rules');
const ignored = new Set(check.stdout.split('\0'));
const parts = ['ספין זוגי / Couple Spin'];
let count = 0;
for (const { oid, path } of files) {
  if (ignored.has(path)) continue;
  const content = execFileSync('git', ['cat-file', 'blob', oid], options);
  if (/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|"private_key"\s*:\s*"[^"]+"/i.test(content)) {
    throw new Error('Export stopped because a tracked file contains credential material');
  }
  parts.push('', `████ FILE: ${path} ████`, content.replace(/\r\n/g, '\n'));
  count++;
}

const temp = realpathSync(tmpdir());
const rel = relative(root, temp);
if (!(isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep))) {
  throw new Error('Choose a temporary directory outside the repository');
}
const out = join(mkdtempSync(join(temp, 'couple-spin-export-')), 'code.txt');
writeFileSync(out, parts.join('\n'), { flag: 'wx', mode: 0o600 });
console.log(`Exported ${count} files to ${out}`);
