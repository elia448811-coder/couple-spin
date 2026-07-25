import { allQuestions } from './allQuestions';
import { allTasks } from './allTasks';
import { intimacyQuestions } from './intimacyQuestions';
import { meet100Questions } from './meet100Questions';
import { matureQuestions, matureTasks } from './matureContent';
import { getCustomCoupleTasks } from '../utils/customContent';
import {
  getCachedContentOverrides,
  mergeContentWithOverrides,
} from '../utils/contentOverrides';
import type { ContentKind, CoupleTask } from '../types/game';

export const builtInContent: CoupleTask[] = [
  ...allTasks,
  ...allQuestions,
  ...meet100Questions,
  ...intimacyQuestions,
  ...matureTasks,
  ...matureQuestions,
];

/** מאגר מלא כולל overrides מענן + תוכן מותאם מקומי */
export function getAllContent(): CoupleTask[] {
  return mergeContentWithOverrides(
    builtInContent,
    getCachedContentOverrides(),
    getCustomCoupleTasks(),
  );
}

/** @deprecated השתמשו ב-getAllContent() — נשמר לתאימות */
export const allContent: CoupleTask[] = builtInContent;

export function isQuestion(item: CoupleTask): boolean {
  return item.kind === 'question';
}

export function contentKind(item: CoupleTask): ContentKind {
  return item.kind ?? 'task';
}

export function getContentBankStats() {
  const all = getAllContent();
  const custom = getCustomCoupleTasks();
  const tasks = all.filter((c) => (c.kind ?? 'task') === 'task').length;
  const questions = all.filter((c) => c.kind === 'question').length;
  return { tasks, questions, total: tasks + questions, custom: custom.length, builtIn: builtInContent.length };
}

export function isMatureContent(item: CoupleTask): boolean {
  return item.category === 'spicy';
}
