import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scratch = mkdtempSync(join(tmpdir(), 'couple-spin-export-test-'));
const repo = join(scratch, 'repo');
mkdirSync(repo);
const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
git('init', '-q');
writeFileSync(join(repo, '.gitignore'), 'ignored.json\n');
writeFileSync(join(repo, 'safe.ts'), 'indexed source');
writeFileSync(join(repo, 'ignored.json'), '{}');
writeFileSync(join(repo, 'service-account.json'), '{}');
writeFileSync(join(repo, 'untracked.json'), '{}');
git('add', '.gitignore', 'safe.ts', 'service-account.json');
git('add', '-f', 'ignored.json');
writeFileSync(join(repo, 'safe.ts'), 'private local edit');
const exporter = fileURLToPath(new URL('./export-code-txt.mjs', import.meta.url));
const run = () => spawnSync(process.execPath, [exporter], {
  cwd: repo, encoding: 'utf8', env: { ...process.env, TMP: scratch, TEMP: scratch, TMPDIR: scratch },
});
const result = run();
assert.equal(result.status, 0, result.stderr);
const path = result.stdout.trim().match(/ files to (.+)$/)[1];
assert.ok(path.startsWith(join(scratch, 'couple-spin-export-')));
const data = readFileSync(path, 'utf8');
assert.match(data, /indexed source/);
assert.doesNotMatch(data, /private local edit|FILE: (?:ignored|untracked|service-account)\.json/);
writeFileSync(join(repo, 'innocent.json'), JSON.stringify({ type: 'service_account' }));
git('add', 'innocent.json');
assert.notEqual(run().status, 0);
console.log('Source exporter file selection, destination and credential checks passed.');
