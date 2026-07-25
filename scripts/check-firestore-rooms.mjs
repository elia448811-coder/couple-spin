import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

if (!config.apiKey || !config.projectId) {
  console.error('Missing Firebase config in .env.local');
  process.exit(2);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function newRoomId() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanup(roomId, displayCode) {
  try {
    await deleteDoc(doc(db, 'roomCodes', displayCode));
  } catch { /* ignore */ }
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch { /* ignore */ }
}

const { user: host } = await signInAnonymously(auth);
const roomId = newRoomId();
const displayCode = randomCode();
const now = Date.now();
const expiresAtMs = now + 2 * 60 * 60 * 1000;

console.log('Host uid:', host.uid);
console.log('Testing room architecture on project:', config.projectId);

const { setDoc, serverTimestamp, writeBatch, runTransaction } = await import('firebase/firestore');

try {
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', roomId), {
    roomId,
    displayCode,
    hostUid: host.uid,
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
    updatedBy: host.uid,
    hostReady: false,
    partnerReady: false,
    hostLastSeenMs: now,
    partnerLastSeenMs: 0,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'roomCodes', displayCode), {
    roomId,
    displayCode,
    expiresAtMs,
    hostUid: host.uid,
    createdAtMs: now,
  });
  await batch.commit();
  console.log('✓ create room + roomCodes');

  await updateDoc(doc(db, 'rooms', roomId), { hostReady: true, hostLastSeenMs: Date.now() });
  console.log('✓ host ready on room doc');

  const codeSnap = await getDoc(doc(db, 'roomCodes', displayCode));
  if (!codeSnap.exists()) throw new Error('roomCodes lookup failed');
  console.log('✓ roomCodes readable');

  // GAME_STARTED requires both players ready — use PLAYER_READY for smoke test.
  const eventId = `evt-${Date.now()}`;
  await runTransaction(db, async (tx) => {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await tx.get(roomRef);
    const version = Number(snap.data()?.version) || 0;
    tx.set(doc(db, 'rooms', roomId, 'events', eventId), {
      type: 'PLAYER_READY',
      version: version + 1,
      createdBy: host.uid,
      createdAtMs: Date.now(),
      payload: { ready: true },
    });
    tx.update(roomRef, {
      version: version + 1,
      lastEventId: eventId,
      updatedBy: host.uid,
      updatedAtMs: Date.now(),
    });
  });
  console.log('✓ append event with version bump');

  const eventsSnap = await getDocs(
    query(collection(db, 'rooms', roomId, 'events'), orderBy('version', 'asc'), limit(5)),
  );
  if (eventsSnap.empty) throw new Error('events subcollection empty');
  console.log('✓ events subcollection readable, count:', eventsSnap.size);

  console.log(JSON.stringify({ ok: true, roomId, displayCode, projectId: config.projectId }, null, 2));
} catch (error) {
  console.error('✗ Firestore room test failed:', error instanceof Error ? error.message : error);
  console.error('\nIf rules were just published, wait 30s and retry.');
  process.exit(1);
} finally {
  await cleanup(roomId, displayCode);
  console.log('✓ cleanup done');
}
