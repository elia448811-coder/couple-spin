import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import {
  BUILTIN_TASK_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  type BuiltinTaskCategory,
  type TaskCategory,
} from '../types/game';
import { assertAdmin } from './admin';

export type CategoryDef = {
  id: string;
  label: string;
  icon: string;
  order: number;
  builtin: boolean;
};

const DEFAULT_BUILTIN: CategoryDef[] = BUILTIN_TASK_CATEGORIES.map((id, order) => ({
  id,
  label: CATEGORY_LABELS[id],
  icon: CATEGORY_ICONS[id],
  order,
  builtin: true,
}));

let cachedCategories: CategoryDef[] = DEFAULT_BUILTIN.map((c) => ({ ...c }));

export function getDefaultCategories(): CategoryDef[] {
  return DEFAULT_BUILTIN.map((c) => ({ ...c }));
}

export function getCachedCategories(): CategoryDef[] {
  return cachedCategories;
}

export function getCategoryLabel(id: string): string {
  const found = cachedCategories.find((c) => c.id === id);
  if (found?.label) return found.label;
  if ((BUILTIN_TASK_CATEGORIES as readonly string[]).includes(id)) {
    return CATEGORY_LABELS[id as BuiltinTaskCategory];
  }
  return id;
}

export function getCategoryIcon(id: string): string {
  const found = cachedCategories.find((c) => c.id === id);
  if (found?.icon) return found.icon;
  if ((BUILTIN_TASK_CATEGORIES as readonly string[]).includes(id)) {
    return CATEGORY_ICONS[id as BuiltinTaskCategory];
  }
  return '✦';
}

export function isValidCategoryId(raw: string): boolean {
  return /^[a-z][a-z0-9_-]{1,31}$/.test(raw.trim());
}

function normalizeLabel(label: string): string {
  return label.trim().slice(0, 40);
}

function normalizeIcon(icon: string): string {
  const t = icon.trim().slice(0, 8);
  return t || '✦';
}

function parseCategories(raw: unknown): CategoryDef[] {
  if (!raw || typeof raw !== 'object') return getDefaultCategories();
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || !items.length) return getDefaultCategories();

  const byId = new Map<string, CategoryDef>();
  for (const builtin of DEFAULT_BUILTIN) byId.set(builtin.id, { ...builtin });

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    if (!isValidCategoryId(id)) continue;
    const builtin = (BUILTIN_TASK_CATEGORIES as readonly string[]).includes(id);
    const prev = byId.get(id);
    byId.set(id, {
      id,
      label: normalizeLabel(String(o.label ?? prev?.label ?? id)) || id,
      icon: normalizeIcon(String(o.icon ?? prev?.icon ?? '✦')),
      order: Number.isFinite(Number(o.order)) ? Number(o.order) : (prev?.order ?? byId.size),
      builtin,
    });
  }

  return [...byId.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'he'));
}

export async function fetchCategories(): Promise<CategoryDef[]> {
  if (!isFirebaseConfigured()) {
    cachedCategories = getDefaultCategories();
    return cachedCategories;
  }
  try {
    const db = await getFirestoreDb();
    if (!db) {
      cachedCategories = getDefaultCategories();
      return cachedCategories;
    }
    const snap = await getDoc(doc(db, 'config', 'categories'));
    cachedCategories = snap.exists()
      ? parseCategories(snap.data())
      : getDefaultCategories();
    return cachedCategories;
  } catch {
    cachedCategories = getDefaultCategories();
    return cachedCategories;
  }
}

export async function saveCategories(items: CategoryDef[]): Promise<CategoryDef[]> {
  const adminUid = await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');

  const cleaned = parseCategories({ items });
  // Ensure all builtins remain
  for (const builtin of DEFAULT_BUILTIN) {
    if (!cleaned.some((c) => c.id === builtin.id)) {
      cleaned.push({ ...builtin, order: cleaned.length });
    }
  }
  cleaned.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'he'));

  await setDoc(
    doc(db, 'config', 'categories'),
    {
      items: cleaned,
      updatedAtMs: Date.now(),
      updatedBy: adminUid,
    },
    { merge: true },
  );
  cachedCategories = cleaned;
  return cleaned;
}

export async function upsertCategory(input: {
  id: string;
  label: string;
  icon?: string;
  order?: number;
}): Promise<CategoryDef[]> {
  const id = input.id.trim().toLowerCase();
  if (!isValidCategoryId(id)) {
    throw new Error('מזהה קטגוריה: אות קטנה באנגלית, ואז אותיות/מספרים/_/- (2–32).');
  }
  const label = normalizeLabel(input.label);
  if (!label) throw new Error('יש להזין שם קטגוריה.');

  const current = await fetchCategories();
  const builtin = (BUILTIN_TASK_CATEGORIES as readonly string[]).includes(id);
  const existing = current.find((c) => c.id === id);
  const next: CategoryDef = {
    id,
    label,
    icon: normalizeIcon(input.icon ?? existing?.icon ?? (builtin ? CATEGORY_ICONS[id as BuiltinTaskCategory] : '✦')),
    order: input.order ?? existing?.order ?? current.length,
    builtin,
  };
  const merged = existing
    ? current.map((c) => (c.id === id ? next : c))
    : [...current, next];
  return saveCategories(merged);
}

export async function removeCustomCategory(id: string): Promise<CategoryDef[]> {
  if ((BUILTIN_TASK_CATEGORIES as readonly string[]).includes(id)) {
    throw new Error('לא ניתן למחוק קטגוריה מובנית — אפשר רק לערוך את השם.');
  }
  const current = await fetchCategories();
  return saveCategories(current.filter((c) => c.id !== id));
}

export function sortCategoryIds(ids: Iterable<string>): string[] {
  const order = new Map(getCachedCategories().map((c, i) => [c.id, c.order ?? i]));
  return [...new Set(ids)].sort((a, b) => {
    const oa = order.has(a) ? order.get(a)! : 999;
    const ob = order.has(b) ? order.get(b)! : 999;
    if (oa !== ob) return oa - ob;
    return getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'he');
  });
}

export function asTaskCategory(id: string): TaskCategory {
  return id as TaskCategory;
}
