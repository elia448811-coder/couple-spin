import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLatestEveningRating,
  getTaskFeedback,
  saveEveningRating,
  setTaskFeedback,
} from './taskFeedback';

describe('taskFeedback', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
    });
  });

  it('stores thumbs up/down per task', () => {
    setTaskFeedback('task-1', 'up');
    expect(getTaskFeedback('task-1')).toBe('up');
    setTaskFeedback('task-1', 'down');
    expect(getTaskFeedback('task-1')).toBe('down');
  });

  it('stores evening star rating', () => {
    saveEveningRating('ערב רומנטי', 4);
    expect(getLatestEveningRating('ערב רומנטי')).toBe(4);
  });
});
