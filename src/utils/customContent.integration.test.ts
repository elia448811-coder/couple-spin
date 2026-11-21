import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('customContent in game pool', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    localStorage.clear();
  });

  afterEach(async () => {
    await vi.dynamicImportSettled();
  });

  it('custom question appears in filterTasks pool', async () => {
    const { addCustomContent } = await import('./customContent');
    const { filterTasks } = await import('./taskSelection');

    addCustomContent({
      kind: 'question',
      title: 'שאלה מותאמת',
      description: 'מה אתם אוהבים יחד?',
      category: 'romantic',
      level: 'normal',
    });

    const pool = filterTasks('romantic', 'normal', [], true, { contentMode: 'questions' });
    expect(pool.some((t) => t.id.startsWith('custom-'))).toBe(true);
  });
});
