import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(file) {
  return readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const canonical = read('firestore.rules');
for (const file of [
  'PASTE-FIREBASE-RULES.txt',
  'הדבק-Rules-לאדמין.txt',
  'הדבק-עכשיו-Rules-מלא.txt',
  'הדבק-בפיירבייס-Rules.txt',
]) {
  const source = read(file);
  const start = source.search(/^rules_version = '2';$/m);
  assert.notEqual(start, -1, file + ' has no rules header');
  assert.ok(source.slice(start) === canonical, file + ' must match firestore.rules');
}
