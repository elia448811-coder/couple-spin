import { describe, expect, it } from 'vitest';
import { buildQuestionsExportText, countExportItems } from './exportQuestionsFile';

describe('exportQuestionsFile', () => {
  it('builds a non-empty questions export', () => {
    const text = buildQuestionsExportText();
    expect(text).toContain('ספין זוגי');
    expect(text).toContain('שאלות');
    expect(text.split('\n').some((l) => /^\d+\.\s/.test(l.trim()))).toBe(true);
  });

  it('filters export by selected categories', () => {
    const romantic = buildQuestionsExportText({ categories: ['romantic'] });
    const all = buildQuestionsExportText();
    expect(romantic).toContain('קטגוריות: romantic');
    expect(romantic.length).toBeLessThan(all.length);

    const romanticCount = countExportItems({ categories: ['romantic'] }).questions;
    const allCount = countExportItems().questions;
    expect(romanticCount).toBeGreaterThan(0);
    expect(romanticCount).toBeLessThan(allCount);
  });

  it('exports nothing when category has no matches', () => {
    const counts = countExportItems({ categories: ['does-not-exist'] });
    expect(counts.questions).toBe(0);
    expect(counts.tasks).toBe(0);
  });
});
