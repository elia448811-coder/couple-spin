import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.VITE_FIREBASE_APP_ID?.trim(),
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const { user } = await signInAnonymously(auth);
const now = Date.now();
const expiresAtMs = now + 2 * 60 * 60 * 1000;

async function tryCreate(label, displayCode) {
  const roomId = `test-${Date.now()}-${label}`;
  const room = {
    roomId,
    displayCode,
    hostUid: user.uid,
    partnerUid: null,
    hostName: 'בדיקה',
    partnerName: null,
    status: 'waiting',
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs,
    version: 0,
    eveningTitle: 'בדיקה',
    lastEventId: null,
    updatedBy: user.uid,
    hostReady: false,
    partnerReady: false,
    hostLastSeenMs: now,
    partnerLastSeenMs: 0,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'rooms', roomId), room);
    console.log(`✓ room create ${label} code=${displayCode}`);
    try {
      await setDoc(doc(db, 'roomCodes', displayCode), {
        roomId,
        displayCode,
        expiresAtMs,
        hostUid: user.uid,
        createdAtMs: now,
      });
      console.log(`✓ roomCodes create ${label}`);
      await deleteDoc(doc(db, 'roomCodes', displayCode));
    } catch (e) {
      console.log(`✗ roomCodes ${label}:`, e instanceof Error ? e.message : e);
    }
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (e) {
    console.log(`✗ room create ${label}:`, e instanceof Error ? e.message : e);
  }
}

console.log('uid', user.uid, 'project', config.projectId);
await tryCreate('6digit', String(100000 + Math.floor(Math.random() * 900000)));
await tryCreate('8digit', String(10000000 + Math.floor(Math.random() * 90000000)));
