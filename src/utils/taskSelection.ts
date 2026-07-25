import { getAllContent } from '../data/allContent';
import { getQuestionBankStats } from '../data/allQuestions';
import { meet100Questions } from '../data/meet100Questions';
import { intimacyQuestions } from '../data/intimacyQuestions';
import { matureQuestions, matureTasks } from '../data/matureContent';
import { allTasks } from '../data/allTasks';
import type { ContentMode, CoupleTask, GameMode, TaskCategory, TaskLevel } from '../types/game';
import { isTaskHidden, taskAllowedByBoundaries } from './privacy';

const MODE_CATEGORIES: Record<GameMode, TaskCategory[]> = {
  funny: ['funny', 'movement', 'creative'],
  romantic: ['romantic', 'calm', 'creative'],
  challenge: ['challenge', 'movement', 'funny'],
  calm: ['calm', 'romantic', 'creative'],
  mixed: ['funny', 'romantic', 'challenge', 'calm', 'creative', 'movement'],
  spicy: ['spicy'],
};

const LEVEL_ORDER: TaskLevel[] = ['easy', 'normal', 'advanced'];

export function getCategoriesForMode(mode: GameMode): TaskCategory[] {
  return MODE_CATEGORIES[mode];
}

function levelDown(level: TaskLevel): TaskLevel {
  const i = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER[Math.max(0, i - 1)];
}

function levelUp(level: TaskLevel): TaskLevel {
  const i = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, i + 1)];
}

function matchesContentMode(item: CoupleTask, contentMode: ContentMode, mode: GameMode): boolean {
  const kind = item.kind ?? 'task';
  if (mode === 'spicy') {
    if (contentMode === 'tasks') return kind === 'task';
    if (contentMode === 'questions') return kind === 'question';
    return true;
  }
  if (contentMode === 'tasks') return kind === 'task';
  if (contentMode === 'questions') return kind === 'question';
  return true;
}

export function filterTasks(
  mode: GameMode,
  level: TaskLevel,
  usedIds: string[],
  advancedEnabled: boolean,
  options: {
    preferredCategory?: TaskCategory | null;
    preferredQuestionGroup?: string | null;
    coupleOnly?: boolean;
    categoryFilter?: TaskCategory | null;
    levelOverride?: TaskLevel;
    contentMode?: ContentMode;
  } = {},
): CoupleTask[] {
  const modeCategories = getCategoriesForMode(mode);
  const effectiveLevel = options.levelOverride ?? level;
  const contentMode = options.contentMode ?? 'tasks';
  const allowedLevels: TaskLevel[] =
    effectiveLevel === 'easy'
      ? ['easy']
      : effectiveLevel === 'normal'
        ? ['easy', 'normal']
        : ['easy', 'normal', 'advanced'];

  return getAllContent().filter((task: CoupleTask) => {
    if (isTaskHidden(task.id)) return false;
    if (!taskAllowedByBoundaries(task)) return false;
    if (task.category === 'spicy' && mode !== 'spicy') return false;
    if (mode === 'spicy' && task.category !== 'spicy') return false;
    if (!matchesContentMode(task, contentMode, mode)) return false;
    if (usedIds.includes(task.id)) return false;
    if (!allowedLevels.includes(task.level)) return false;
    if (task.level === 'advanced' && !advancedEnabled) return false;
    if (options.coupleOnly && !task.isCoupleTask) return false;
    if (options.categoryFilter && task.category !== options.categoryFilter) return false;
    if (options.preferredQuestionGroup) {
      return (
        task.kind === 'question' &&
        task.questionGroup === options.preferredQuestionGroup &&
        modeCategories.includes(task.category)
      );
    }
    if (options.preferredCategory) {
      return task.category === options.preferredCategory && modeCategories.includes(task.category);
    }
    return modeCategories.includes(task.category);
  });
}

export function pickRandomTask(
  mode: GameMode,
  level: TaskLevel,
  usedIds: string[],
  advancedEnabled: boolean,
  options: Parameters<typeof filterTasks>[4] = {},
): CoupleTask | null {
  const pool = filterTasks(mode, level, usedIds, advancedEnabled, options);
  if (pool.length === 0) {
    const fallback = filterTasks(mode, level, [], advancedEnabled, options);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickEasierTask(
  mode: GameMode,
  level: TaskLevel,
  usedIds: string[],
  advancedEnabled: boolean,
  options: Parameters<typeof pickRandomTask>[4] = {},
): CoupleTask | null {
  return pickRandomTask(mode, level, usedIds, advancedEnabled, {
    ...options,
    levelOverride: levelDown(level),
  });
}

export function pickHarderTask(
  mode: GameMode,
  level: TaskLevel,
  usedIds: string[],
  advancedEnabled: boolean,
  options: Parameters<typeof pickRandomTask>[4] = {},
): CoupleTask | null {
  if (level === 'advanced') return null;
  return pickRandomTask(mode, level, usedIds, advancedEnabled, {
    ...options,
    levelOverride: levelUp(level),
  });
}

export function getTasksByCategory(category: TaskCategory): CoupleTask[] {
  return getAllContent().filter((t: CoupleTask) => t.category === category);
}

export function getTaskBankStats() {
  const byCategory = {} as Record<TaskCategory, number>;
  for (const t of [...allTasks, ...matureTasks]) {
    const cat = t.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  return { total: allTasks.length + matureTasks.length, byCategory };
}

export function getFullBankStats(contentMode: ContentMode = 'mixed', mode: GameMode = 'mixed') {
  const taskStats = getTaskBankStats();
  const questionStats = getQuestionBankStats();
  const meet100Count = meet100Questions.length;
  const intimacyCount = intimacyQuestions.length;
  const matureTaskCount = matureTasks.length;
  const matureQuestionCount = matureQuestions.length;

  if (mode === 'spicy') {
    if (contentMode === 'tasks') {
      return { total: matureTaskCount, tasks: matureTaskCount, questions: 0, byCategory: { spicy: matureTaskCount } as Record<TaskCategory, number> };
    }
    if (contentMode === 'questions') {
      return { total: matureQuestionCount, tasks: 0, questions: matureQuestionCount, byCategory: { spicy: matureQuestionCount } as Record<TaskCategory, number> };
    }
    return {
      total: matureTaskCount + matureQuestionCount,
      tasks: matureTaskCount,
      questions: matureQuestionCount,
      byCategory: { spicy: matureTaskCount + matureQuestionCount } as Record<TaskCategory, number>,
    };
  }

  if (contentMode === 'tasks') {
    return { total: taskStats.total, tasks: taskStats.total, questions: 0, byCategory: taskStats.byCategory };
  }
  if (contentMode === 'questions') {
    const questionTotal = questionStats.total + meet100Count + intimacyCount + matureQuestionCount;
    return {
      total: questionTotal,
      tasks: 0,
      questions: questionTotal,
      byCategory: { ...questionStats.byCategory, spicy: matureQuestionCount } as Record<TaskCategory, number>,
    };
  }
  return {
    total: taskStats.total + questionStats.total + meet100Count + intimacyCount + matureQuestionCount,
    tasks: taskStats.total,
    questions: questionStats.total + meet100Count + intimacyCount + matureQuestionCount,
    byCategory: taskStats.byCategory,
  };
}
