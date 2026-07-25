import { getAllContent } from '../data/allContent';
import type { CoupleTask } from '../types/game';

function isQuestion(item: CoupleTask): boolean {
  return item.kind === 'question';
}

/** Build a concentrated Hebrew questions text file from the live content bank. */
export function buildQuestionsExportText(options?: { includeTasks?: boolean }): string {
  const all = getAllContent();
  const questions = all.filter(isQuestion);
  const tasks = options?.includeTasks ? all.filter((i) => !isQuestion(i)) : [];

  const lines: string[] = [
    '══════════════════════════════════════════',
    '  ספין זוגי — ייצוא שאלות מהמערכת',
    `  תאריך: ${new Date().toLocaleString('he-IL')}`,
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

export function downloadQuestionsFile(options?: { includeTasks?: boolean; filename?: string }): number {
  const text = buildQuestionsExportText(options);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options?.filename ?? `שאלות-ספין-זוגי-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return text.split('\n').filter((l) => /^\d+\./.test(l.trim())).length;
}
