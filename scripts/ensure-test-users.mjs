import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
  signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(host)) {
  throw new Error('Set FIREBASE_AUTH_EMULATOR_HOST to the local Auth emulator');
}
const users = [
  { username: 'test_host', displayName: 'מארח בדיקה', password: process.env.TEST_HOST_PASSWORD },
  { username: 'test_partner', displayName: 'שותף בדיקה', password: process.env.TEST_PARTNER_PASSWORD },
];
if (users.some(user => !user.password || user.password.length < 6)) {
  throw new Error('Supply TEST_HOST_PASSWORD and TEST_PARTNER_PASSWORD from the project vault');
}
const app = initializeApp({ apiKey: 'emulator-only', projectId: 'demo-couple-spin' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://' + host, { disableWarnings: true });
try {
  for (const { username, displayName, password } of users) {
    const email = Buffer.from(username).toString('hex') + '@users.couplespin.app';
    let result;
    try {
      result = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code !== 'auth/email-already-in-use') throw error;
      result = await signInWithEmailAndPassword(auth, email, password);
    }
    await updateProfile(result.user, { displayName });
    await signOut(auth);
    console.log('Local emulator fixture ready:', username);
  }
} finally {
  await deleteApp(app);
}
