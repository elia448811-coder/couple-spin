import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function readConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let initPromise: Promise<FirebaseApp | null> | null = null;

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

export function getFirebaseProjectId(): string | null {
  return readConfig()?.projectId ?? null;
}

export async function ensureFirebaseApp(): Promise<FirebaseApp | null> {
  const config = readConfig();
  if (!config) return null;
  if (app) return app;
  if (!initPromise) {
    initPromise = (async () => {
      const { initializeApp, getApps } = await import('firebase/app');
      app = getApps().length ? getApps()[0]! : initializeApp(config);
      return app;
    })();
  }
  return initPromise;
}

export async function getFirebaseAuth(): Promise<Auth | null> {
  const firebaseApp = await ensureFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    const { getAuth } = await import('firebase/auth');
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export async function getFirestoreDb(): Promise<Firestore | null> {
  const firebaseApp = await ensureFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    const { getFirestore } = await import('firebase/firestore');
    db = getFirestore(firebaseApp);
  }
  return db;
}
