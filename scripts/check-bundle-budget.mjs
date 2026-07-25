import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist', 'assets');
/** Soft budgets — fail CI if main JS/CSS balloons unexpectedly. */
const MAX_JS_BYTES = 550_000;
const MAX_CSS_BYTES = 120_000;
const MAX_TOTAL_BYTES = 750_000;

const files = readdirSync(DIST).filter((name) => name.endsWith('.js') || name.endsWith('.css'));
let js = 0;
let css = 0;
for (const name of files) {
  const size = statSync(join(DIST, name)).size;
  if (name.endsWith('.js')) js += size;
  else css += size;
  console.log(`${name}: ${(size / 1024).toFixed(1)} KiB`);
}

const total = js + css;
console.log(`JS=${(js / 1024).toFixed(1)} KiB CSS=${(css / 1024).toFixed(1)} KiB TOTAL=${(total / 1024).toFixed(1)} KiB`);

if (js > MAX_JS_BYTES || css > MAX_CSS_BYTES || total > MAX_TOTAL_BYTES) {
  console.error('Bundle budget exceeded', { js, css, total, MAX_JS_BYTES, MAX_CSS_BYTES, MAX_TOTAL_BYTES });
  process.exit(1);
}
