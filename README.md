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

בהגדרות → "תוכן מותאם אישית" אפשר להוסיף שאלות ומשימות. הן נשמרות במכשיר ונכללות בגיבוי לחשבון רק אחרי הפעלתו בהגדרות הפרטיות. כיבוי הגיבוי משאיר גיבויים קודמים בענן. בכניסה הראשונה אחרי העדכון נמחקים מהמכשיר נתוני משחק ישנים שאי אפשר לשייך לחשבון.

## מבנה

- `src/` — React app
- `api/` — Vercel serverless auth
- `worker/` — Cloudflare Worker (אופציונלי)
- `scripts/` — בדיקות ובנייה

### Account approval and legacy session storage

Accounts must have an explicit administrator approval. Older profiles without an approval appear in the existing pending queue. Review them individually before releasing the updated Firestore rules. The double-game project owns the shared production rules.

The active game signs in through Firebase. The optional shared-password API on Vercel and Cloudflare requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on each production adapter. Point both at the same store when they accept the same tokens. If the store is unavailable, the legacy API returns HTTP 503. The room join guard retains per-instance throttling when shared storage is unavailable.

The administrator signs in with the existing email alias. Privileged operations require the pinned Firebase UID. For a new Firebase installation, an authorized operator can provision that UID with `set:admin-password` before seeding site settings. When registration is closed, the rules also reject new self-service profiles.

The production client at https://couple-spin-dd845.web.app uses the shared double-game room and registration API. Publish the dedicated Firebase Hosting site with `npm run deploy:hosting`. [Firebase release and verification](functions/README.md)

Before releasing the profile rules, install the dependencies with `npm ci --prefix functions`. Set `GCLOUD_PROJECT` to the reviewed Firebase project and run `node functions/scripts/migrate-admin-notes.mjs` with operator credentials to preview the migration. Add `--apply` to move old notes into `adminUserNotes`. Each move is transactional. Resolve any reported conflicts before rollout. Profiles containing a nonempty legacy note are readable only by the administrator until migrated.

The former `test_host` and `test_partner` fixtures used published passwords. If these accounts exist in a shared Firebase project, disable them and revoke their refresh tokens, or rotate their passwords and revoke existing sessions before retaining them. Future `ensure:test-users` runs require a local Auth emulator and the two fixture passwords from the project vault.

To export reviewed source, run `node scripts/export-code-txt.mjs`. It uses the Git index, skips ignored and credential files, and prints the location of the export in the system temporary directory.
