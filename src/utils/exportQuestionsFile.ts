import { getAllContent } from '../data/allContent';
import type { CoupleTask } from '../types/game';

export type ExportQuestionsOptions = {
  includeTasks?: boolean;
  /** When set and non-empty, only include items whose `category` is in this list. */
  categories?: string[];
  filename?: string;
};

function isQuestion(item: CoupleTask): boolean {
  return item.kind === 'question';
}

function matchesCategories(item: CoupleTask, categories?: string[]): boolean {
  if (!categories?.length) return true;
  return categories.includes(item.category);
}

/** Count active bank items that would be exported for the given filters. */
export function countExportItems(options?: Pick<ExportQuestionsOptions, 'includeTasks' | 'categories'>): {
  questions: number;
  tasks: number;
  total: number;
} {
  const all = getAllContent().filter((item) => matchesCategories(item, options?.categories));
  const questions = all.filter(isQuestion).length;
  const tasks = options?.includeTasks ? all.filter((i) => !isQuestion(i)).length : 0;
  return { questions, tasks, total: questions + tasks };
}

/** Build a concentrated Hebrew questions text file from the live content bank. */
export function buildQuestionsExportText(options?: ExportQuestionsOptions): string {
  const all = getAllContent().filter((item) => matchesCategories(item, options?.categories));
  const questions = all.filter(isQuestion);
  const tasks = options?.includeTasks ? all.filter((i) => !isQuestion(i)) : [];
  const categoryNote = options?.categories?.length
    ? `  קטגוריות: ${options.categories.join(', ')}`
    : '  קטגוריות: הכל';

  const lines: string[] = [
    '══════════════════════════════════════════',
    '  ספין זוגי — ייצוא שאלות מהמערכת',
    `  תאריך: ${new Date().toLocaleString('he-IL')}`,
    categoryNote,
    `  סה"כ שאלות: ${questions.length}`,
    options?.includeTasks ? `  סה"כ משימות: ${tasks.length}` : '',
    '══════════════════════════════════════════',
    '',
  ].filter(Boolean);

  const byTitle = new Map<string, CoupleTask[]>();
  for (const q of questions) {
    const key = q.title || q.questionGroup || 'כללי';
    const list = byTitle.get(key) ?? [];
    list.push(q);
    byTitle.set(key, list);
  }

  for (const [title, items] of byTitle) {
    lines.push('──────────────────────────────────────────');
    lines.push(`  ${title} (${items.length})`);
    lines.push('──────────────────────────────────────────');
    lines.push('');
    items.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.description}`);
      lines.push('');
    });
  }

  if (tasks.length) {
    lines.push('══════════════════════════════════════════');
    lines.push(`  משימות (${tasks.length})`);
    lines.push('══════════════════════════════════════════');
    lines.push('');
    tasks.forEach((t, i) => {
      lines.push(`${i + 1}. [${t.title}] ${t.description}`);
      lines.push('');
    });
  }

  lines.push('══════════════════════════════════════════');
  lines.push('  סוף הקובץ');
  lines.push('══════════════════════════════════════════');
  lines.push('');
  return lines.join('\n');
}

function defaultFilename(options?: ExportQuestionsOptions): string {
  const date = new Date().toISOString().slice(0, 10);
  const cats = options?.categories;
  if (cats?.length === 1) return `שאלות-${cats[0]}-${date}.txt`;
  if (cats?.length) return `שאלות-מסונן-${cats.length}-קטגוריות-${date}.txt`;
  return options?.includeTasks ? `שאלות-ומשימות-${date}.txt` : `שאלות-ספין-זוגי-${date}.txt`;
}

export function downloadQuestionsFile(options?: ExportQuestionsOptions): number {
  const text = buildQuestionsExportText(options);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options?.filename ?? defaultFilename(options);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return text.split('\n').filter((l) => /^\d+\./.test(l.trim())).length;
}
