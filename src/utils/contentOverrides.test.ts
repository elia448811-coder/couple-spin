import { describe, expect, it } from 'vitest';
import { mergeContentWithOverrides, type ContentItemDoc } from './contentOverrides';
import type { CoupleTask } from '../types/game';

const builtIn: CoupleTask[] = [
  {
    id: 'q1',
    title: 'קבוצה',
    description: 'שאלה מקורית',
    category: 'funny',
    level: 'normal',
    kind: 'question',
  },
  {
    id: 't1',
    title: 'משימה',
    description: 'משימה מקורית',
    category: 'romantic',
    level: 'easy',
    kind: 'task',
  },
];

describe('mergeContentWithOverrides', () => {
  it('applies edit override', () => {
    const overrides: ContentItemDoc[] = [
      {
        id: 'q1',
        title: 'קבוצה',
        description: 'שאלה מעודכנת',
        kind: 'question',
        category: 'funny',
        level: 'normal',
        hidden: false,
        source: 'builtin',
        updatedAtMs: 1,
      },
    ];
    const merged = mergeContentWithOverrides(builtIn, overrides, []);
    expect(merged.find((x) => x.id === 'q1')?.description).toBe('שאלה מעודכנת');
    expect(merged).toHaveLength(2);
  });

  it('hides items', () => {
    const overrides: ContentItemDoc[] = [
      {
        id: 't1',
        title: 'משימה',
        description: 'x',
        kind: 'task',
        category: 'romantic',
        level: 'easy',
        hidden: true,
        source: 'builtin',
        updatedAtMs: 1,
      },
    ];
    const merged = mergeContentWithOverrides(builtIn, overrides, []);
    expect(merged.map((x) => x.id)).toEqual(['q1']);
  });

  it('adds custom cloud items', () => {
    const overrides: ContentItemDoc[] = [
      {
        id: 'custom-1',
        title: 'חדש',
        description: 'פריט חדש',
        kind: 'question',
        category: 'calm',
        level: 'normal',
        hidden: false,
        source: 'custom',
        updatedAtMs: 1,
      },
    ];
    const merged = mergeContentWithOverrides(builtIn, overrides, []);
    expect(merged).toHaveLength(3);
    expect(merged.some((x) => x.id === 'custom-1')).toBe(true);
  });
});
