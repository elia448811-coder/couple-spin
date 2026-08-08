import { describe, expect, it } from 'vitest';
import { allContent, getContentBankStats } from '../data/allContent';
import { allQuestions, getQuestionBankStats } from '../data/allQuestions';
import { allTasks } from '../data/allTasks';
import { intimacyQuestions } from '../data/intimacyQuestions';
import { meet100Questions, MEET100_GROUP_LABEL } from '../data/meet100Questions';
import { matureQuestions, matureTasks } from '../data/matureContent';
import { DEFAULT_SETTINGS, getSpinnerSegments, SPINNER_SEGMENTS } from '../types/game';
import { getFullBankStats } from './taskSelection';

describe('data integrity', () => {
  it('has base, meet100, intimacy and mature content banks', () => {
    expect(allTasks.length).toBe(150);
    expect(allQuestions.length).toBe(292);
    expect(meet100Questions.length).toBe(100);
    expect(intimacyQuestions.length).toBe(20);
    expect(matureTasks.length).toBe(130);
    expect(matureQuestions.length).toBe(20);
    expect(allContent.length).toBe(712);
    expect(getContentBankStats().total).toBe(712);
  });

  it('has unique ids across all content', () => {
    const ids = allContent.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all items have non-empty descriptions', () => {
    for (const item of allContent) {
      expect(item.description.trim().length).toBeGreaterThan(5);
      expect(item.id).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.level).toBeTruthy();
    }
  });

  it('questions are marked correctly', () => {
    for (const q of allQuestions) {
      expect(q.kind).toBe('question');
      expect(q.questionGroup).toBeTruthy();
      expect(q.isCoupleTask).toBe(true);
    }
  });

  it('tasks default to task kind', () => {
    for (const t of allTasks) {
      expect(t.kind === undefined || t.kind === 'task').toBe(true);
    }
  });

  it('question groups sum to 292 experiential questions', () => {
    const stats = getQuestionBankStats();
    expect(stats.total).toBe(292);
    const groupSum = Object.values(stats.byGroup).reduce((a, b) => a + b, 0);
    expect(groupSum).toBe(292);
    expect(stats.byGroup.deep).toBe(100);
    expect(stats.byGroup.funny).toBe(18);
    expect(stats.byGroup.summary).toBe(20);
  });

  it('meet100 challenge bank', () => {
    expect(meet100Questions.length).toBe(100);
    for (const q of meet100Questions) {
      expect(q.questionGroup).toBe('meet100');
      expect(q.title).toBe(MEET100_GROUP_LABEL);
      expect(q.kind).toBe('question');
    }
    const texts = meet100Questions.map((q) => q.description);
    expect(new Set(texts).size).toBe(100);
  });

  it('intimacy bank', () => {
    expect(intimacyQuestions.length).toBe(20);
    for (const q of intimacyQuestions) {
      expect(q.questionGroup).toBe('intimacy');
      expect(q.category).toBe('romantic');
    }
  });

  it('bank stats match content modes', () => {
    expect(getFullBankStats('tasks').total).toBe(280);
    expect(getFullBankStats('questions').total).toBe(432);
    expect(getFullBankStats('mixed').total).toBe(712);
    expect(getFullBankStats('mixed', 'spicy').total).toBe(150);
    expect(getFullBankStats('tasks', 'spicy').total).toBe(130);
    expect(getFullBankStats('questions', 'spicy').total).toBe(20);
  });

  it('questions have unique wording', () => {
    const texts = allQuestions.map((q) => q.description);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('questions use clean Hebrew punctuation', () => {
    for (const q of allQuestions) {
      expect(q.description).not.toMatch(/[a-zA-Z]/);
      expect(q.description).not.toContain('פרטנר');
    }
  });

  it('spinner has 8 segments per context', () => {
    expect(SPINNER_SEGMENTS.length).toBe(8);
    expect(SPINNER_SEGMENTS.filter((s) => s.rare).length).toBe(1);
    expect(getSpinnerSegments('mixed', 'questions').length).toBe(8);
    expect(getSpinnerSegments('mixed', 'questions').some((s) => s.questionGroup === 'meet100')).toBe(true);
    expect(getSpinnerSegments('mixed', 'questions').some((s) => s.questionGroup === 'intimacy')).toBe(true);
    expect(getSpinnerSegments('spicy', 'mixed').length).toBe(8);
  });

  it('default settings include all required fields', () => {
    expect(DEFAULT_SETTINGS.lastContentMode).toBe('mixed');
    expect(DEFAULT_SETTINGS.playerOneName).toBeTruthy();
    expect(DEFAULT_SETTINGS.roundCount).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.matureAgeConfirmed).toBe(false);
  });
});
