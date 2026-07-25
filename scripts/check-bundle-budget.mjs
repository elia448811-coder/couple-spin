import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist', 'assets');
/** Budgets for the initial app shell (Firebase loads async on demand). */
const MAX_ENTRY_JS_BYTES = 480_000;
const MAX_CSS_BYTES = 120_000;
const MAX_TOTAL_JS_BYTES = 1_400_000;

const files = readdirSync(DIST).filter((name) => name.endsWith('.js') || name.endsWith('.css'));
let entryJs = 0;
let js = 0;
let css = 0;
for (const name of files) {
  const size = statSync(join(DIST, name)).size;
  if (name.endsWith('.js')) {
    js += size;
    if (name.startsWith('index-')) entryJs += size;
  } else {
    css += size;
  }
  console.log(`${name}: ${(size / 1024).toFixed(1)} KiB`);
}

console.log(
  `entryJS=${(entryJs / 1024).toFixed(1)} KiB JS=${(js / 1024).toFixed(1)} KiB CSS=${(css / 1024).toFixed(1)} KiB`,
);

if (entryJs > MAX_ENTRY_JS_BYTES || css > MAX_CSS_BYTES || js > MAX_TOTAL_JS_BYTES) {
  console.error('Bundle budget exceeded', {
    entryJs,
    js,
    css,
    MAX_ENTRY_JS_BYTES,
    MAX_CSS_BYTES,
    MAX_TOTAL_JS_BYTES,
  });
  process.exit(1);
}
