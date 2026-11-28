import { isFirebaseConfigured } from '../lib/firebase';

const APP_PREFIX = 'couple-spin-';
const USER_PREFIX = 'couple-spin-user:';
const OWNER_KEY = 'couple-spin-owner';
let owner: string | null | undefined;
let retired = false;
let storageAvailable = true;

function namespace(uid: string): string {
  return USER_PREFIX + encodeURIComponent(uid) + ':';
}

function removeMatching(storage: Storage, match: (key: string) => boolean): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && match(key)) storage.removeItem(key);
  }
}

function clearMatching(match: (key: string) => boolean): void {
  removeMatching(localStorage, match);
  removeMatching(sessionStorage, match);
}

function updateStoredOwner(previous: string | null | undefined, uid: string | null): void {
  const keep = uid ? namespace(uid) : null;
  const recorded = localStorage.getItem(OWNER_KEY);
  // A delayed logout in another tab must only clear its departing account.
  const staleNotification = previous && recorded !== previous && recorded !== uid;
  clearMatching(key => {
    if (!key.startsWith(APP_PREFIX) || key === OWNER_KEY) return false;
    if (key === 'couple-spin-join-attempts' || key === 'couple-spin-feature-flags') return false;
    if (key === 'couple-spin-auth-session') return Boolean(previous);
    if (staleNotification) return key.startsWith(namespace(previous));
    // Older versions used unattributed keys. Their owner cannot be established.
    return !(keep && key.startsWith(keep));
  });
  if (!staleNotification) {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
    else localStorage.removeItem(OWNER_KEY);
  }
}

/** Never let outstanding callbacks from a signed-out page use the next user's namespace. */
export function bindStorageAccount(uid: string | null): boolean {
  if (retired) return false;
  if (uid === owner) return true;
  const previous = owner;
  owner = uid;
  if (previous) retired = true;
  try {
    updateStoredOwner(previous, uid);
  } catch {
    // Browsers with blocked storage can play without persistence or backup.
    storageAvailable = false;
  }
  if (retired) window.location.reload();
  return !retired;
}

export function storageUid(): string | null {
  if (retired || !storageAvailable || !owner) return null;
  try {
    return localStorage.getItem(OWNER_KEY) === owner ? owner : null;
  } catch {
    return null;
  }
}

function scopedKey(key: string): string | null {
  if (retired || !storageAvailable) return null;
  if (owner) return storageUid() ? namespace(owner) + key : null;
  return isFirebaseConfigured() ? null : key;
}

function scopedStorage(getStore: () => Storage) {
  return {
    getItem(key: string): string | null {
      const scoped = scopedKey(key);
      return scoped ? getStore().getItem(scoped) : null;
    },
    setItem(key: string, value: string): void {
      const scoped = scopedKey(key);
      if (scoped) getStore().setItem(scoped, value);
    },
    removeItem(key: string): void {
      const scoped = scopedKey(key);
      if (scoped) getStore().removeItem(scoped);
    },
  };
}

export const accountLocal = scopedStorage(() => localStorage);
export const accountSession = scopedStorage(() => sessionStorage);

export function clearAccountStorage(): void {
  clearMatching(key => key.startsWith(APP_PREFIX));
}
