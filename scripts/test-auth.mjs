#!/usr/bin/env node
/**
 * בדיקת מנגנון האימות — wiring, אבטחה, ובדיקה חיה אופציונלית של Worker.
 * שימוש: node scripts/test-auth.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const errors = [];
const notes = [];

function fail(msg) {
  errors.push(msg);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function scanBundleForSecrets() {
  const assetsDir = join(root, 'dist', 'assets');
  if (!existsSync(assetsDir)) {
    fail('dist/assets חסר — הרץ build לפני בדיקת bundle');
    return;
  }

  const forbidden = [/PASS_W/i, /password\s*===\s*['"][^'"]{8,}/, /SITE_PASSWORD/i];
  for (const file of readdirSync(assetsDir)) {
    if (!file.endsWith('.js')) continue;
    const content = readFileSync(join(assetsDir, file), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(content)) {
        fail(`נמצאה סיסמה/סוד ב-bundle: dist/assets/${file}`);
      }
    }
  }
  notes.push('bundle production נקי מסיסמות hardcoded');
}

function validateWiring() {
  const main = read('src/main.tsx');
  if (!/<AuthGuard>\s*\n?\s*<App/.test(main)) {
    fail('main.tsx חייב לעטוף את App ב-AuthGuard');
  }

  const app = read('src/app/App.tsx');
  if (app.includes('SiteGate') || app.includes('useSiteGate')) {
    fail('App.tsx לא צריך להכיל SiteGate — רק AuthGuard ב-main.tsx');
  }

  if (!existsSync(join(root, 'src/components/AuthGuard.tsx'))) {
    fail('חסר src/components/AuthGuard.tsx');
  } else {
    const guard = read('src/components/AuthGuard.tsx');
    if (!guard.includes('useSiteGate') || !guard.includes('SiteGate')) {
      fail('AuthGuard חייב להשתמש ב-useSiteGate ו-SiteGate');
    }
    if (/password\s*===/.test(guard)) {
      fail('AuthGuard לא צריך להשוות סיסמה בצד לקוח');
    }
  }

  notes.push('AuthGuard מחובר ב-main.tsx, App נקי משכבת gate כפולה');
}

function validateWorkerSource() {
  const worker = read('worker/index.js');
  if (!worker.includes('timingSafeEqual')) {
    fail('worker/index.js חייב timingSafeEqual');
  }
  if (!worker.includes('createSessionToken') || !worker.includes('/session')) {
    fail('worker/index.js חייב session token + /session endpoint');
  }
  if (!worker.includes('rateByIp') || !worker.includes('rate_limited')) {
    fail('worker/index.js חייב rate limiting');
  }
  if (!worker.includes('env.PASS_W')) {
    fail('worker/index.js חייב env.PASS_W');
  }
  if (/PASS_W\s*=\s*['"]/.test(worker)) {
    fail('worker/index.js לא צריך להכיל PASS_W hardcoded');
  }
  notes.push('Worker — אימות סיסמה בצד שרת בלבד');
}

function validateSiteGateSource() {
  const siteGate = read('src/utils/siteGate.ts');
  if (!siteGate.includes('/verify')) {
    fail('siteGate.ts חייב לקרוא ל-/verify');
  }
  if (!siteGate.includes('/session') || !siteGate.includes('sessionStorage')) {
    fail('siteGate.ts חייב session token + sessionStorage');
  }
  if (siteGate.includes('PASS_W') || siteGate.includes('SITE_PASSWORD')) {
    fail('siteGate.ts לא צריך להכיל סיסמה');
  }
  notes.push('siteGate — קריאת API בלבד, ללא סיסמה בקוד');
}

function validateVercelApi() {
  for (const f of ['api/verify.js', 'api/session.js', 'api/health.js', 'api/_lib/auth.js']) {
    if (!existsSync(join(root, f))) fail(`חסר ${f}`);
  }
  const auth = read('api/_lib/auth.js');
  if (!auth.includes('SITE_PASSWORD') || !auth.includes('createSessionToken')) {
    fail('api/_lib/auth.js חייב SITE_PASSWORD + session tokens');
  }
  if (/SITE_PASSWORD\s*=\s*['"]/.test(auth)) {
    fail('סיסמה לא צריכה להיות hardcoded ב-API');
  }
  if (!auth.includes('parseAllowedOrigins') && !auth.includes('ALLOWED_ORIGINS')) {
    fail('api auth חייב allowlist ל-CORS');
  }
  notes.push('Vercel API auth — verify/session/health');
}

async function probeLiveWorker() {
  const url = (process.env.VITE_AUTH_API_URL || process.env.AUTH_TEST_URL || '').replace(/\/$/, '');
  if (!url) {
    notes.push('Worker חי: דולג (VITE_AUTH_API_URL לא מוגדר — השער כבוי ב-build)');
    return;
  }

  try {
    const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8000) });
    if (!health.ok) {
      fail(`Worker /health החזיר ${health.status}`);
      return;
    }
    const data = await health.json();
    if (data.ok !== true) {
      fail('Worker /health: תגובה לא תקינה');
      return;
    }
    notes.push(`Worker חי: ${url} (gate=${data.gate ? 'מוגדר' : 'לא מוגדר'})`);

    const bad = await fetch(`${url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '__wrong_test__' }),
      signal: AbortSignal.timeout(8000),
    });
    if (bad.status !== 401 && bad.status !== 503) {
      fail(`Worker /verify עם סיסמה שגויה: צפוי 401/503, קיבל ${bad.status}`);
    } else {
      notes.push('Worker /verify דוחה סיסמה שגויה כצפוי');
    }

    const noToken = await fetch(`${url}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
      signal: AbortSignal.timeout(8000),
    });
    if (noToken.status !== 401 && noToken.status !== 503) {
      fail(`Worker /session ללא token: צפוי 401/503, קיבל ${noToken.status}`);
    } else {
      notes.push('Worker /session דוחה token ריק');
    }
  } catch (e) {
    fail(`Worker לא נגיש: ${e.message}`);
  }
}

console.log('▶ בדיקת מנגנון אימות...\n');

validateWiring();
validateSiteGateSource();
validateVercelApi();
validateWorkerSource();
scanBundleForSecrets();
await probeLiveWorker();

for (const n of notes) console.log(`  ✓ ${n}`);

if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\n  ❌ בדיקת אימות נכשלה\n');
  process.exit(1);
}

console.log('\n  ✅ מנגנון האימות תקין\n');
