import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GameState } from '../types/game';

const firebase = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'alice', isAnonymous: false } as { uid: string; isAnonymous: boolean } | null },
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../lib/firebase', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseAuth: async () => firebase.auth,
  getFirestoreDb: async () => ({}),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  serverTimestamp: () => 1234,
  getDoc: firebase.getDoc,
  setDoc: firebase.setDoc,
}));
vi.mock('firebase/auth', () => ({ signOut: firebase.signOut }));

function browserStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.clearAllMocks();
  firebase.getDoc.mockResolvedValue({ exists: () => false });
  firebase.signOut.mockImplementation(async () => { firebase.auth.currentUser = null; });
  firebase.auth.currentUser = { uid: 'alice', isAnonymous: false };
  const local = browserStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', browserStorage());
  vi.stubGlobal('window', { localStorage: local, addEventListener: vi.fn(), location: { reload: vi.fn() } });
  vi.stubGlobal('document', { addEventListener: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('saves custom content locally until this account opts in, then backs up the documented fields', async () => {
  const { bindStorageAccount } = await import('./accountStorage');
  bindStorageAccount('alice');
  const sync = await import('./cloudSync');
  const { addCustomContent, loadCustomContent } = await import('./customContent');
  const add = () => addCustomContent({ kind: 'task', title: 'My own task', description: 'Local entry', category: 'romantic', level: 'normal' });
  add();
  await vi.dynamicImportSettled();
  await vi.runAllTimersAsync();
  expect(loadCustomContent()).toHaveLength(1);
  await sync.syncCloudOnStartup();
  await sync.pingFirestore();
  await sync.pushUserData();
  await sync.pushCloudSnapshot({ screen: 'game' } as GameState);
  await (await import('./userProfile')).incrementGamesPlayed();
  expect(firebase.getDoc).not.toHaveBeenCalled();
  expect(firebase.setDoc).not.toHaveBeenCalled();

  sync.setCloudConsent(true);
  expect((await sync.pushUserData()).ok).toBe(true);
  const [path, value] = firebase.setDoc.mock.calls[0]!;
  expect(path).toBe('users/alice/coupleSpinBackup/bundle');
  expect(Object.keys(value).sort()).toEqual(['payload', 'updatedAt', 'updatedAtMs']);
  expect(JSON.parse(value.payload).customContent[0].title).toBe('My own task');
  await sync.pushCloudSnapshot({ screen: 'game' } as GameState);
  expect(firebase.setDoc.mock.calls[1]?.[0]).toBe('users/alice/coupleSpinBackup/activeGame');

  sync.scheduleCloudPush();
  const { setGuestMode } = await import('./privacy');
  setGuestMode(true);
  await vi.dynamicImportSettled();
  await vi.runAllTimersAsync();
  await sync.pushCloudSnapshot({ screen: 'game' } as GameState);
  expect(firebase.setDoc).toHaveBeenCalledTimes(2);
});

it.each(['logout', 'switch'])('purges private state and abandons in-flight backup on %s', async transition => {
  const { bindStorageAccount, accountLocal, accountSession } = await import('./accountStorage');
  localStorage.setItem('couple-spin-history', 'unattributed legacy data');
  sessionStorage.setItem('couple-spin-undo', 'unattributed legacy snapshot');
  localStorage.setItem('another-app', 'keep');
  bindStorageAccount('alice');
  expect(localStorage.getItem('couple-spin-history')).toBeNull();
  expect(sessionStorage.length).toBe(0);
  for (const key of ['room-id', 'user-profile', 'history', 'boundaries', 'task-feedback', 'custom-content']) {
    accountLocal.setItem('couple-spin-' + key, 'alice');
  }
  accountSession.setItem('couple-spin-active-game', 'alice');
  accountSession.setItem('couple-spin-undo', 'alice');
  const sync = await import('./cloudSync');
  sync.setCloudConsent(true);
  sync.scheduleCloudPush();
  let finishRead!: (value: { exists: () => boolean }) => void;
  firebase.getDoc.mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
  const inFlight = sync.pushUserData();
  await vi.dynamicImportSettled();
  expect(firebase.getDoc).toHaveBeenCalled();
  if (transition === 'logout') {
    const { signOutUser } = await import('./userAuth');
    expect((await signOutUser()).ok).toBe(true);
    expect(firebase.signOut).toHaveBeenCalled();
  } else {
    firebase.auth.currentUser = { uid: 'bob', isAnonymous: false };
    bindStorageAccount('bob');
  }
  finishRead({ exists: () => false });
  expect((await inFlight).ok).toBe(false);
  await vi.runAllTimersAsync();
  accountLocal.setItem('couple-spin-history', 'stale completion');
  expect(firebase.setDoc).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(transition === 'logout' ? 1 : 2);
  expect(localStorage.getItem('another-app')).toBe('keep');
  expect(sessionStorage.length).toBe(0);
  expect(window.location.reload).toHaveBeenCalled();

  vi.resetModules(); // New document for the incoming account.
  const next = await import('./accountStorage');
  next.bindStorageAccount('bob');
  expect(next.accountLocal.getItem('couple-spin-history')).toBeNull();
  expect(next.accountSession.getItem('couple-spin-active-game')).toBeNull();
  expect((await import('./cloudSync')).hasCloudConsent()).toBe(false);
});

it('restores the same account and reads legacy backups only after consent', async () => {
  const store = await import('./accountStorage');
  store.bindStorageAccount('alice');
  store.accountLocal.setItem('couple-spin-custom-content', '[]');
  const sync = await import('./cloudSync');
  sync.setCloudConsent(true);
  vi.resetModules();
  (await import('./accountStorage')).bindStorageAccount('alice');
  const restored = await import('./cloudSync');
  expect(restored.hasCloudConsent()).toBe(true);
  firebase.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ game: { screen: 'game', eveningName: 'Legacy game' } }) });
  expect((await restored.pullCloudSnapshot())?.eveningName).toBe('Legacy game');
  firebase.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ updatedAtMs: 10, achievements: ['first_game'] }) });
  expect((await restored.pullUserData()).bundle?.achievements).toEqual(['first_game']);
  const { clearAllLocalData } = await import('./storage');
  expect(clearAllLocalData().ok).toBe(true);
  expect(localStorage.length).toBe(0);
  expect(restored.hasCloudConsent()).toBe(false);
});

it('ignores a delayed logout in another tab after the new account has started saving', async () => {
  const oldTab = await import('./accountStorage');
  oldTab.bindStorageAccount('alice');
  oldTab.accountLocal.setItem('couple-spin-history', 'alice');
  vi.resetModules();
  const newTab = await import('./accountStorage');
  newTab.bindStorageAccount('bob');
  newTab.accountLocal.setItem('couple-spin-history', 'bob');
  oldTab.accountLocal.setItem('couple-spin-history', 'stale write');
  expect(oldTab.accountLocal.getItem('couple-spin-history')).toBeNull();
  oldTab.bindStorageAccount(null);
  expect(newTab.accountLocal.getItem('couple-spin-history')).toBe('bob');
});

it('stops a pending upload if consent is revoked during the remote read', async () => {
  (await import('./accountStorage')).bindStorageAccount('alice');
  const sync = await import('./cloudSync');
  sync.setCloudConsent(true);
  let finishRead!: (value: { exists: () => boolean }) => void;
  firebase.getDoc.mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
  const pending = sync.pushUserData();
  await vi.dynamicImportSettled();
  sync.setCloudConsent(false);
  finishRead({ exists: () => false });
  expect((await pending).ok).toBe(false);
  expect(firebase.setDoc).not.toHaveBeenCalled();
});
