# Shared Firebase operations

Couple Spin is served from `https://couple-spin-dd845.web.app`. The web client signs in to Firebase project `double-game-dd845` and calls the room and registration API at `https://double-game-black.vercel.app`. That service verifies the Firebase user and charges room admission attempts before resolving a code. The client subscribes to a bounded query of server-written `gameEvents`. Opt-in Couple Spin backups are stored under `users/{uid}/coupleSpinBackup`.

The double-game repository owns production Firestore rules, room retention and the API. The emulator uses a copy of those rules via `firebase.emulator.json`. This repository's `firebase.json` deploys the dedicated Hosting site. No Cloud Functions or Firestore TTL deployment is required.

From the repository root, install dependencies with `npm ci` and `npm ci --prefix functions`. Run the permissions and migration checks with Java and the Firebase CLI installed.

```sh
firebase emulators:exec --config firebase.emulator.json --only firestore --project demo-couple-spin "node functions/scripts/test-profile-rules.mjs && node functions/scripts/test-rooms.mjs"
```

Run `npm run deploy:hosting` to build and publish. The predeploy step retrieves the selected web app's public Firebase configuration. The double-game API must allow the exact Hosting origin for the room and registration routes.

To migrate old administrative notes, set `GCLOUD_PROJECT` to the intended project and use application-default operator credentials. Run `node functions/scripts/migrate-admin-notes.mjs` for the preview, then add `--apply` during the coordinated release window. Each transaction preserves the full note in `adminUserNotes/{uid}` and removes it from the public profile. Conflicting or unrecognized records are left for operator review. Room cleanup is handled by the shared service after checking expiration or orphan status.
