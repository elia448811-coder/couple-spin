import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import type { ContentKind, CoupleTask, TaskCategory, TaskLevel } from '../types/game';

export type ContentItemDoc = {
  id: string;
  title: string;
  description: string;
  kind: ContentKind;
  category: TaskCategory;
  level: TaskLevel;
  questionGroup?: string;
  hidden: boolean;
  source: 'builtin' | 'custom';
  updatedAtMs: number;
  /** When true, remove override and restore built-in (delete doc). */
  deleted?: boolean;
};

let cachedOverrides: ContentItemDoc[] = [];
const listeners = new Set<() => void>();

export function getCachedContentOverrides(): ContentItemDoc[] {
  return cachedOverrides;
}

export function subscribeContentOverridesCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const l of listeners) l();
}

function parseDoc(id: string, raw: Record<string, unknown>): ContentItemDoc {
  return {
    id,
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    kind: raw.kind === 'question' ? 'question' : 'task',
    category: (raw.category as TaskCategory) || 'funny',
    level: (raw.level as TaskLevel) || 'normal',
    questionGroup: typeof raw.questionGroup === 'string' ? raw.questionGroup : undefined,
    hidden: Boolean(raw.hidden),
    source: raw.source === 'custom' ? 'custom' : 'builtin',
    updatedAtMs: Number(raw.updatedAtMs) || 0,
  };
}

export function mergeContentWithOverrides(
  builtIn: CoupleTask[],
  overrides: ContentItemDoc[],
  localCustom: CoupleTask[],
): CoupleTask[] {
  const byId = new Map<string, ContentItemDoc>();
  for (const o of overrides) byId.set(o.id, o);

  const result: CoupleTask[] = [];
  for (const item of builtIn) {
    const o = byId.get(item.id);
    if (!o) {
      result.push(item);
      continue;
    }
    if (o.hidden) continue;
    result.push({
      ...item,
      title: o.title || item.title,
      description: o.description || item.description,
      kind: o.kind ?? item.kind,
      category: o.category || item.category,
      level: o.level || item.level,
      questionGroup: o.questionGroup ?? item.questionGroup,
    });
    byId.delete(item.id);
  }

  // Remaining overrides = new custom cloud items
  for (const o of byId.values()) {
    if (o.hidden || o.source !== 'custom') continue;
    result.push({
      id: o.id,
      title: o.title,
      description: o.description,
      kind: o.kind,
      category: o.category,
      level: o.level,
      questionGroup: o.questionGroup,
    });
  }

  const cloudIds = new Set(result.map((r) => r.id));
  for (const c of localCustom) {
    if (!cloudIds.has(c.id)) result.push(c);
  }
  return result;
}

export async function fetchContentOverrides(): Promise<ContentItemDoc[]> {
  if (!isFirebaseConfigured()) {
    cachedOverrides = [];
    return [];
  }
  const db = await getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, 'contentItems'));
  cachedOverrides = snap.docs.map((d) => parseDoc(d.id, d.data() as Record<string, unknown>));
  notify();
  return cachedOverrides;
}

export function subscribeContentOverrides(onChange?: (items: ContentItemDoc[]) => void): () => void {
  let unsub: Unsubscribe = () => {};
  let cancelled = false;
  void (async () => {
    if (!isFirebaseConfigured()) return;
    const db = await getFirestoreDb();
    if (!db || cancelled) return;
    unsub = onSnapshot(collection(db, 'contentItems'), (snap) => {
      cachedOverrides = snap.docs.map((d) => parseDoc(d.id, d.data() as Record<string, unknown>));
      notify();
      onChange?.(cachedOverrides);
    });
  })();
  return () => {
    cancelled = true;
    unsub();
  };
}

export async function upsertContentItem(item: Omit<ContentItemDoc, 'updatedAtMs'>): Promise<void> {
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  const payload: ContentItemDoc = { ...item, updatedAtMs: Date.now() };
  await setDoc(doc(db, 'contentItems', item.id), payload, { merge: true });
}

export async function deleteContentOverride(id: string): Promise<void> {
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  await deleteDoc(doc(db, 'contentItems', id));
}

export function builtInToEditable(item: CoupleTask): ContentItemDoc {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    kind: item.kind === 'question' ? 'question' : 'task',
    category: item.category,
    level: item.level,
    questionGroup: item.questionGroup,
    hidden: false,
    source: 'builtin',
    updatedAtMs: 0,
  };
}
