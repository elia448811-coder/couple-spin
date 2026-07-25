import { describe, expect, it } from 'vitest';
import {
  getCategoryLabel,
  getDefaultCategories,
  isValidCategoryId,
  sortCategoryIds,
} from './adminCategories';

describe('adminCategories', () => {
  it('validates category ids', () => {
    expect(isValidCategoryId('funny')).toBe(true);
    expect(isValidCategoryId('date_night')).toBe(true);
    expect(isValidCategoryId('A')).toBe(false);
    expect(isValidCategoryId('1bad')).toBe(false);
    expect(isValidCategoryId('ab')).toBe(true);
  });

  it('returns default builtin categories', () => {
    const cats = getDefaultCategories();
    expect(cats.some((c) => c.id === 'romantic' && c.builtin)).toBe(true);
    expect(cats.length).toBeGreaterThanOrEqual(7);
  });

  it('labels builtins in Hebrew', () => {
    expect(getCategoryLabel('romantic')).toBe('רומנטי');
  });

  it('sorts by configured order', () => {
    const sorted = sortCategoryIds(['spicy', 'funny', 'romantic']);
    expect(sorted[0]).toBe('funny');
    expect(sorted.at(-1)).toBe('spicy');
  });
});
