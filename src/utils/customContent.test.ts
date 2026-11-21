import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCustomContent,
  customToCoupleTask,
  loadCustomContent,
  removeCustomContent,
} from './customContent';

vi.mock('./cloudSync', () => ({ scheduleCloudPush: vi.fn() }));

function mockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
}

describe('customContent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
  });

  afterEach(async () => {
    await vi.dynamicImportSettled();
    vi.unstubAllGlobals();
  });

  it('adds and loads a custom question by category', () => {
    const item = addCustomContent({
      kind: 'question',
      title: 'שאלה שלנו',
      description: 'מה הדבר הכי מצחיק שקרה לנו?',
      category: 'funny',
      level: 'easy',
    });

    expect(item).not.toBeNull();
    expect(loadCustomContent()).toHaveLength(1);
    expect(loadCustomContent()[0].category).toBe('funny');
  });

  it('converts to CoupleTask for game pool', () => {
    const item = addCustomContent({
      kind: 'task',
      title: 'משימה',
      description: 'עשו סלפי מצחיק',
      category: 'creative',
      level: 'normal',
    })!;

    const task = customToCoupleTask(item);
    expect(task.id).toBe(item.id);
    expect(task.kind).toBe('task');
    expect(task.isCoupleTask).toBe(true);
  });

  it('removes custom content by id', () => {
    const item = addCustomContent({
      kind: 'question',
      title: 'זמני',
      description: 'שאלה',
      category: 'romantic',
      level: 'normal',
    })!;

    removeCustomContent(item.id);
    expect(loadCustomContent()).toHaveLength(0);
  });

  it('rejects empty title or description', () => {
    expect(
      addCustomContent({
        kind: 'question',
        title: '',
        description: 'יש תיאור',
        category: 'calm',
        level: 'easy',
      }),
    ).toBeNull();
  });
});
