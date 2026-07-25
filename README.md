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
