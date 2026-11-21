# ספין זוגי · Couple Spin

משחק משימות ושאלות לזוגות — גלגל ספין, קובייה, בוט שופט, ומצב 18+.

## הרצה מקומית

```bash
npm ci
npm run dev
```

## בדיקות

```bash
npm test
npm run test:system
```

## פריסה ל-Vercel

1. חברו את הריפו ל-Vercel (או `npx vercel`).
2. הגדירו משתני סביבה:
   - `SITE_PASSWORD` — סיסמת הכניסה (רק בשרת)
   - `VITE_SITE_GATE=true` — מפעיל את שער הכניסה ב-build
   - `VITE_BASE_PATH=/`
3. Deploy.

האימות רץ ב-`/api/verify` ו-`/api/session` (HMAC session, rate limit). הסיסמה **לא** נמצאת ב-JavaScript של הדפדפן.

## תוכן מותאם

בהגדרות → "תוכן מותאם אישית" — הוספת שאלות/משימות לקטגוריות (נשמר במכשיר).

## מבנה

- `src/` — React app
- `api/` — Vercel serverless auth
- `worker/` — Cloudflare Worker (אופציונלי)
- `scripts/` — בדיקות ובנייה

### Account approval and legacy session storage

Accounts must have an explicit administrator approval. Older profiles without an approval appear in the existing pending queue. Review them individually before releasing the updated Firestore rules. Deploy the reviewed rules to the shared Firebase project separately from the web deployment.

The active game signs in through Firebase. The optional shared-password API on Vercel and Cloudflare requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on each production adapter. Point both at the same store when they accept the same tokens. If the store is unavailable, the legacy API returns HTTP 503. The room join guard retains per-instance throttling when shared storage is unavailable.
