const base = (process.env.DEPLOY_URL || 'https://double-game-black.vercel.app').replace(/\/$/, '');
const password = process.env.SITE_PASSWORD || '';

const h = await fetch(`${base}/api/health`);
console.log('health', h.status, await h.json());

const bad = await fetch(`${base}/api/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: '__wrong_probe__' }),
});
console.log('bad password', bad.status, await bad.json());

if (password) {
  const good = await fetch(`${base}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const gj = await good.json();
  console.log('good password', good.status, { ok: gj.ok, hasToken: Boolean(gj.token) });
} else {
  console.log('good password skipped (set SITE_PASSWORD env to probe)');
}

const page = await fetch(`${base}/`);
const html = await page.text();
console.log('page', page.status, 'len', html.length, 'hasRoot', html.includes('id="root"'));

const jsMatch = html.match(/assets\/index-[^.]+\.js/);
if (jsMatch) {
  const js = await (await fetch(`${base}/${jsMatch[0]}`)).text();
  const leakMarkers = ['SITE_PASSWORD', 'PASS_W=', 'sessionSigningSecret'];
  console.log(
    'secret-like markers in bundle?',
    leakMarkers.some((m) => js.includes(m)),
  );
  console.log('has /api string?', js.includes('/api'));
  console.log('has verify path?', js.includes('/verify'));
  console.log('has site-gate class?', js.includes('site-gate'));
  console.log('has auth session key?', js.includes('couple-spin-auth-session'));
}
