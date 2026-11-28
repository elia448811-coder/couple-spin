# Firebase room service

The static app uses the Firebase callable `coupleRoomAccess` in the default Functions region. The Functions runtime uses its Firebase service identity for Firestore. Each approved host can have one live room. Repeated create requests resume it. Closing a room retains a 30-second creation cooldown. The join budget covers ten lookups per signed-in user per five minutes, including successful joins. A live room accepts up to 2,048 host game updates and stores only its latest snapshot.

## Local verification

Install the app dependencies at the repository root and run `npm ci --prefix functions` with Node 22. From the repository root, run the following with the Firebase CLI and Java installed.

```sh
firebase emulators:exec --only firestore --project demo-couple-spin "npm run check:firestore-rooms"
```

The room checks use the Firebase SDK's emulator test identities and refuse remote endpoints. They exercise the callable's Firestore transactions, client security rules and migration selection.

## Release

The repository's default Firebase project is shared. Coordinate the rules and client release with other users of these collections. The rollout changes direct room admission and retires reads and writes to the old room event subcollections. Existing eight-digit legacy rooms can be joined until they expire. Active members on older clients should refresh after the web release.

1. Install the Functions dependencies and deploy the named codebase to the selected Firebase project with `firebase deploy --only functions:couple-spin-rooms --project PROJECT_ID`. The project must support Cloud Functions and Firestore TTL billing.
2. Deploy the reviewed Firestore rules and indexes for that project, then release the web client. Confirm that the `coupleSpinExpireAt` TTL policies are active. A room stops accepting operations at its recorded expiry. Physical deletion by Firestore TTL is asynchronous.
3. With an operator identity authorized for that project, run `node functions/scripts/migrate-room-expiry.mjs PROJECT_ID` to count legacy records. The utility marks recognized rooms and reservations for their original expiration and marks retired rate limits and events, including orphan events, for immediate expiry. Ambiguous records are counted as skipped. Confirm collection ownership with the other application before using `--apply`. Re-running after concurrent changes is safe. Review skipped records separately.

The emulator verifies stored TTL timestamps and explicit cleanup on leave. Physical TTL deletion is a managed Firestore operation.
