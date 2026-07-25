import type { ContentKind, CoupleTask, TaskCategory, TaskLevel } from '../types/game';

const CUSTOM_CONTENT_KEY = 'couple-spin-custom-content';
const LEVELS = new Set<TaskLevel>(['easy', 'normal', 'advanced']);

function isAllowedCategory(value: unknown): value is TaskCategory {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{1,31}$/.test(value);
}

export type CustomContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  category: TaskCategory;
  level: TaskLevel;
  questionGroup?: string;
  createdAt: string;
};

export type NewCustomContentInput = {
  kind: ContentKind;
  title: string;
  description: string;
  category: TaskCategory;
  level: TaskLevel;
  questionGroup?: string;
};

function normalizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function sanitizeItem(raw: unknown): CustomContentItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind === 'question' || o.kind === 'task' ? o.kind : null;
  const category = isAllowedCategory(o.category) ? o.category : null;
  const level = LEVELS.has(o.level as TaskLevel) ? (o.level as TaskLevel) : null;
  const title = typeof o.title === 'string' ? normalizeText(o.title, 120) : '';
  const description = typeof o.description === 'string' ? normalizeText(o.description, 500) : '';
  if (!kind || !category || !level || !title || !description) return null;
  return {
    id: typeof o.id === 'string' && o.id.length < 80 ? o.id : `custom-${crypto.randomUUID()}`,
    kind,
    title,
    description,
    category,
    level,
    questionGroup:
      typeof o.questionGroup === 'string' && o.questionGroup.trim()
        ? o.questionGroup.trim().slice(0, 40)
        : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
  };
}

export function loadCustomContent(): CustomContentItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CONTENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeItem).filter((x): x is CustomContentItem => Boolean(x));
  } catch {
    return [];
  }
}

function saveCustomContent(items: CustomContentItem[]): { ok: boolean } {
  try {
    localStorage.setItem(CUSTOM_CONTENT_KEY, JSON.stringify(items));
    void import('./cloudSync').then(({ scheduleCloudPush }) => scheduleCloudPush());
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function customToCoupleTask(item: CustomContentItem): CoupleTask {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    level: item.level,
    kind: item.kind,
    questionGroup: item.questionGroup,
    isCoupleTask: item.kind === 'task',
  };
}

export function getCustomCoupleTasks(): CoupleTask[] {
  return loadCustomContent().map(customToCoupleTask);
}

export function addCustomContent(input: NewCustomContentInput): CustomContentItem | null {
  const title = normalizeText(input.title, 120);
  const description = normalizeText(input.description, 500);
  if (!title || !description) return null;
  if (!isAllowedCategory(input.category) || !LEVELS.has(input.level)) return null;

  const item: CustomContentItem = {
    id: `custom-${crypto.randomUUID()}`,
    kind: input.kind,
    title,
    description,
    category: input.category,
    level: input.level,
    questionGroup: input.questionGroup?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const result = saveCustomContent([item, ...loadCustomContent()]);
  return result.ok ? item : null;
}

export function removeCustomContent(id: string): void {
  saveCustomContent(loadCustomContent().filter((item) => item.id !== id));
}

export function getCustomContentStats() {
  const items = loadCustomContent();
  const questions = items.filter((i) => i.kind === 'question').length;
  const tasks = items.filter((i) => i.kind === 'task').length;
  return { total: items.length, questions, tasks };
}
