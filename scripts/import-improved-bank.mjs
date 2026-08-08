/**
 * מייבא את מאגר השאלות/משימות המשופר (כולל 18+) לקבצי src/data.
 *
 * שימוש:
 *   node scripts/import-improved-bank.mjs
 *   node scripts/import-improved-bank.mjs --src "path/to/file.txt"
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '..');

const DEFAULT_SRC = join(projectRoot, 'ספין-זוגי-שאלות-ומשימות-משופר-18plus.txt');
const DOWNLOAD_SRC = join(
  process.env.USERPROFILE || '',
  'Downloads',
  'ספין-זוגי-שאלות-ומשימות-משופר-18plus.txt',
);

const SECTION_MAP = [
  { match: 'לב אל לב', group: 'deep', category: 'romantic', level: 'advanced' },
  { match: 'סיבוב צחוקים', group: 'funny', category: 'funny', level: 'easy' },
  { match: 'רגעים קטנים', group: 'romantic', category: 'romantic', level: 'normal' },
  { match: 'מבט קדימה', group: 'future', category: 'calm', level: 'normal' },
  { match: 'החיים עצמם', group: 'routine', category: 'calm', level: 'easy' },
  { match: 'מדברים פתוח', group: 'communication', category: 'calm', level: 'normal' },
  { match: 'בית, משפחה', group: 'family', category: 'romantic', level: 'normal' },
  { match: 'כסף, עבודה', group: 'money', category: 'challenge', level: 'advanced' },
  { match: 'דמיון חופשי', group: 'creative', category: 'creative', level: 'normal' },
  { match: 'חימום נעים', group: 'icebreaker', category: 'funny', level: 'easy' },
  { match: 'סגירת ערב', group: 'summary', category: 'calm', level: 'easy' },
  { match: 'עוד 100 שאלות עומק', group: 'meet100', category: 'challenge', level: 'easy' },
  { match: 'קרבה זוגית', group: 'intimacy', category: 'romantic', level: 'normal' },
  { match: 'שאלות 18+', group: 'spicy', category: 'spicy', level: 'normal' },
];

const GROUP_LABELS = {
  deep: 'לב אל לב — היכרות עמוקה',
  funny: 'סיבוב צחוקים — קליל ומשחרר',
  romantic: 'רגעים קטנים של אהבה',
  future: 'מבט קדימה — חלומות ותוכניות',
  routine: 'החיים עצמם — שגרה שעושה טוב',
  communication: 'מדברים פתוח — תקשורת מקרבת',
  family: 'בית, משפחה וערכים',
  money: 'כסף, עבודה ואיזון',
  creative: 'דמיון חופשי — שאלות יצירתיות',
  icebreaker: 'חימום נעים — לפתוח את הערב',
  summary: 'סגירת ערב — מה לוקחים איתנו',
  meet100: 'עוד 100 שאלות עומק — להכיר באמת',
  intimacy: 'קרבה זוגית נקייה ומכבדת',
  spicy: 'שאלות 18+',
};

/** Title → category/level from the known 1–150 bank (couple + extras). */
const KNOWN_TASK_META = {
  'פרצוף בלי לצחוק': { category: 'funny', level: 'easy', durationSeconds: 10 },
  'קול רובוט': { category: 'funny', level: 'easy', durationSeconds: 20 },
  'הליכה מצחיקה': { category: 'movement', level: 'easy' },
  'שם גיבור': { category: 'funny', level: 'easy' },
  'לחיצת יד זוגית': { category: 'creative', level: 'easy' },
  'תחרות חיוך': { category: 'funny', level: 'easy' },
  'דרמה מוגזמת': { category: 'funny', level: 'normal', durationSeconds: 30 },
  'פוזת דוגמנים': { category: 'funny', level: 'easy', durationSeconds: 5 },
  'חקיין את התנועה': { category: 'movement', level: 'easy' },
  'ריקוד זוגי': { category: 'movement', level: 'easy', durationSeconds: 10 },
  'תחרות מבטים': { category: 'funny', level: 'easy' },
  'מבטא מצחיק': { category: 'funny', level: 'normal' },
  'חדשות הערב': { category: 'funny', level: 'normal' },
  'פרסומת מצחיקה': { category: 'creative', level: 'normal' },
  'כינוי חמוד': { category: 'funny', level: 'easy' },
  'קול חיה': { category: 'funny', level: 'easy' },
  'מחיאות כפיים': { category: 'funny', level: 'easy' },
  'סדרה דמיונית': { category: 'creative', level: 'normal' },
  'סלפי מצחיק': { category: 'funny', level: 'easy' },
  'רצינות קשה': { category: 'funny', level: 'easy', durationSeconds: 10 },
  'מחמאה אמיתית': { category: 'romantic', level: 'easy' },
  'החזקת ידיים': { category: 'romantic', level: 'easy', durationSeconds: 20 },
  'שיר לאווירה': { category: 'romantic', level: 'easy', durationSeconds: 20 },
  'חיבוק נעים': { category: 'romantic', level: 'easy' },
  'תודה קטנה': { category: 'romantic', level: 'easy' },
  קרבה: { category: 'romantic', level: 'easy' },
  'פתק חמוד': { category: 'romantic', level: 'normal' },
  'ניקוד בצחוק': { category: 'romantic', level: 'easy' },
  'מילת קסם': { category: 'romantic', level: 'easy' },
  'תנועת לב': { category: 'romantic', level: 'easy' },
  'כוס שתייה': { category: 'romantic', level: 'normal' },
  'מחמאה על אופי': { category: 'romantic', level: 'easy' },
  'חיוך בשקט': { category: 'romantic', level: 'easy', durationSeconds: 10 },
  'תמונה זוגית': { category: 'romantic', level: 'easy' },
  'סימן סודי': { category: 'romantic', level: 'normal' },
  'מילה טובה': { category: 'romantic', level: 'easy' },
  'שם לערב': { category: 'romantic', level: 'easy' },
  'High Five חגיגי': { category: 'romantic', level: 'easy' },
  'משפט עידוד': { category: 'romantic', level: 'easy' },
  'תכנון נעים': { category: 'romantic', level: 'easy' },
};

function argSrc() {
  const idx = process.argv.indexOf('--src');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (existsSync(DEFAULT_SRC)) return DEFAULT_SRC;
  if (existsSync(DOWNLOAD_SRC)) return DOWNLOAD_SRC;
  throw new Error('לא נמצא קובץ המאגר המשופר');
}

function detectQuestionSection(line) {
  for (const s of SECTION_MAP) {
    if (line.includes(s.match)) return s;
  }
  return null;
}

function esc(s) {
  return JSON.stringify(s);
}

function extractDuration(text) {
  const m = text.match(/(\d+)\s*שנ/);
  return m ? Number(m[1]) : undefined;
}

function inferRegularCategory(title, description, index) {
  const known = KNOWN_TASK_META[title];
  if (known) return known;

  const blob = `${title} ${description}`;
  if (/מצחיק|צחוק|רובוט|פרצוף|סלפי|חיה|דרמה|גיבור/.test(blob)) {
    return { category: 'funny', level: 'easy' };
  }
  if (/ריקוד|הליכה|קפיצ|תנועה|זריק/.test(blob)) {
    return { category: 'movement', level: 'easy' };
  }
  if (/ציור|המצא|סיפור|לוגו|יציר|פלייליסט|שפה/.test(blob)) {
    return { category: 'creative', level: 'normal' };
  }
  if (/שקט|נשימ|רגוע|מדיט|נוחות|תאורה/.test(blob)) {
    return { category: 'calm', level: 'easy' };
  }
  if (/אתגר|תחרות|מגדל|ספיר|ספירה|שיווי/.test(blob)) {
    return { category: 'challenge', level: 'normal' };
  }
  if (/חיבוק|נשיק|מחמאה|רומנ|אהב|ידיים/.test(blob)) {
    return { category: 'romantic', level: 'easy' };
  }
  // bands by position for the classic 1–100 layout
  if (index < 20) return { category: 'funny', level: 'easy' };
  if (index < 40) return { category: 'romantic', level: 'easy' };
  if (index < 60) return { category: 'challenge', level: 'normal' };
  if (index < 80) return { category: 'calm', level: 'easy' };
  if (index < 100) return { category: 'creative', level: 'normal' };
  return { category: 'funny', level: 'easy' };
}

function parseBank(content) {
  const questionBuckets = Object.fromEntries(SECTION_MAP.map((s) => [s.group, []]));
  /** @type {{ title: string, description: string }[]} */
  const regularTasks = [];
  /** @type {{ title: string, description: string }[]} */
  const spicyTasks = [];

  let mode = 'meta'; // meta | questions | tasks | spicy-tasks
  let currentGroup = null;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes('סוף הקובץ')) break;
    if (/^[═─]+$/.test(line)) continue;

    if (line.startsWith('משימות 18+')) {
      mode = 'spicy-tasks';
      currentGroup = null;
      continue;
    }
    if (line.startsWith('משימות (')) {
      mode = 'tasks';
      currentGroup = null;
      continue;
    }

    if (mode !== 'tasks' && mode !== 'spicy-tasks') {
      const section = detectQuestionSection(line);
      if (section && !/^\d+\./.test(line)) {
        mode = 'questions';
        currentGroup = section.group;
        continue;
      }
    }

    const numbered = line.match(/^\d+\.\s*(.+)$/);
    if (!numbered) continue;
    const body = numbered[1].trim();

    if (mode === 'spicy-tasks') {
      const tm = body.match(/^\[(.+?)\]\s*(.+)$/);
      if (!tm) throw new Error(`משימת 18+ לא בפורמט: ${line.slice(0, 80)}`);
      spicyTasks.push({ title: tm[1].trim(), description: tm[2].trim() });
      continue;
    }

    if (mode === 'tasks') {
      const tm = body.match(/^\[(.+?)\]\s*(.+)$/);
      if (!tm) throw new Error(`משימה לא בפורמט: ${line.slice(0, 80)}`);
      regularTasks.push({ title: tm[1].trim(), description: tm[2].trim() });
      continue;
    }

    if (mode === 'questions' && currentGroup) {
      questionBuckets[currentGroup].push(body);
    }
  }

  return { questionBuckets, regularTasks, spicyTasks };
}

function renderQuestionItem(t) {
  return `  {
    id: '${t.id}',
    title: ${esc(t.title)},
    description: ${esc(t.description)},
    kind: 'question',
    questionGroup: '${t.questionGroup}',
    category: '${t.category}',
    level: '${t.level}',
    isCoupleTask: true,
  }`;
}

function renderTaskItem(t) {
  const duration = t.durationSeconds ? `,\n    durationSeconds: ${t.durationSeconds}` : '';
  const couple = t.isCoupleTask === undefined ? '' : `,\n    isCoupleTask: ${t.isCoupleTask}`;
  return `  {
    id: '${t.id}',
    title: ${esc(t.title)},
    description: ${esc(t.description)},
    category: '${t.category}',
    level: '${t.level}'${duration}${couple},
  }`;
}

function buildMainQuestions(buckets) {
  const mainGroups = SECTION_MAP.filter((s) => !['meet100', 'intimacy', 'spicy'].includes(s.group));
  const out = [];
  let n = 0;
  for (const { group, category, level } of mainGroups) {
    const texts = buckets[group];
    if (!texts?.length) throw new Error(`חסרות שאלות בקבוצה ${group}`);
    for (const description of texts) {
      n += 1;
      out.push({
        id: `q-${String(n).padStart(3, '0')}`,
        title: GROUP_LABELS[group],
        description,
        questionGroup: group,
        category,
        level,
      });
    }
  }
  return out;
}

function buildMeet100(buckets) {
  const texts = buckets.meet100;
  if (texts.length !== 100) throw new Error(`צפוי 100 meet100, קיבל ${texts.length}`);
  return texts.map((description, i) => {
    const n = i + 1;
    const level = n <= 40 ? 'easy' : n <= 80 ? 'normal' : 'advanced';
    return {
      id: `meet-${String(n).padStart(3, '0')}`,
      title: GROUP_LABELS.meet100,
      description,
      questionGroup: 'meet100',
      category: 'challenge',
      level,
    };
  });
}

function buildIntimacy(buckets) {
  const texts = buckets.intimacy;
  if (texts.length !== 20) throw new Error(`צפוי 20 intimacy, קיבל ${texts.length}`);
  return texts.map((description, i) => ({
    id: `intim-${String(i + 1).padStart(3, '0')}`,
    title: GROUP_LABELS.intimacy,
    description,
    questionGroup: 'intimacy',
    category: 'romantic',
    level: 'normal',
  }));
}

function buildSpicyQuestions(buckets) {
  const texts = buckets.spicy;
  if (texts.length !== 20) throw new Error(`צפוי 20 שאלות 18+, קיבל ${texts.length}`);
  return texts.map((description, i) => {
    const n = i + 1;
    const level = n <= 7 ? 'easy' : n <= 14 ? 'normal' : 'advanced';
    return {
      id: `spicy-q-${String(n).padStart(2, '0')}`,
      title: GROUP_LABELS.spicy,
      description,
      questionGroup: 'spicy',
      category: 'spicy',
      level,
    };
  });
}

function splitRegularAndLegacySpicy(regularTasks) {
  if (regularTasks.length !== 180) {
    throw new Error(`צפוי 180 משימות בבלוק הראשי, קיבל ${regularTasks.length}`);
  }
  return {
    clean: regularTasks.slice(0, 150),
    legacySpicy: regularTasks.slice(150),
  };
}

function buildCoupleAndExtra(cleanTasks) {
  const couple = [];
  const extra = [];
  cleanTasks.forEach((item, index) => {
    const meta = inferRegularCategory(item.title, item.description, index);
    const durationSeconds = meta.durationSeconds ?? extractDuration(item.description);
    const task = {
      id:
        index < 100
          ? `${meta.category === 'movement' && index < 20 ? 'funny' : meta.category === 'movement' ? 'movement' : meta.category}-${String(index + 1).padStart(3, '0')}`
          : `extra-${index + 1}`,
      title: item.title,
      description: item.description,
      category: meta.category,
      level: meta.level,
      ...(durationSeconds ? { durationSeconds } : {}),
    };
    // Keep classic ids for first 100 as close as possible to old scheme
    if (index < 100) {
      const band =
        index < 20
          ? 'funny'
          : index < 40
            ? 'romantic'
            : index < 60
              ? 'challenge'
              : index < 80
                ? 'calm'
                : 'creative';
      task.id = `${band}-${String(index + 1).padStart(3, '0')}`;
      // Prefer band category for classic layout, but keep movement/creative overrides from known meta
      if (!KNOWN_TASK_META[item.title]) task.category = band === 'funny' && meta.category === 'movement' ? 'movement' : band === 'funny' && meta.category === 'creative' ? 'creative' : band;
      else task.category = meta.category;
      couple.push(task);
    } else {
      task.id = `extra-${index + 1}`;
      task.isCoupleTask = true;
      extra.push(task);
    }
  });
  return { couple, extra };
}

function buildSpicyTasks(legacySpicy, spicyTasks) {
  const all = [...legacySpicy, ...spicyTasks];
  if (all.length < 100) throw new Error(`מעט מדי משימות 18+: ${all.length}`);
  return all.map((item, i) => {
    const n = i + 1;
    const durationSeconds = extractDuration(item.description);
    const level = n <= 40 ? 'easy' : n <= 90 ? 'normal' : 'advanced';
    return {
      id: `spicy-${String(n).padStart(3, '0')}`,
      title: item.title,
      description: item.description,
      category: 'spicy',
      level,
      isCoupleTask: true,
      ...(durationSeconds ? { durationSeconds } : {}),
    };
  });
}

function writeAllQuestions(tasks) {
  const labels = { ...GROUP_LABELS };
  delete labels.meet100;
  delete labels.intimacy;
  // keep spicy in QUESTION_GROUP_LABELS for TaskModal group labels via allQuestions type —
  // spicy questions live in matureContent, but label stays for reference.
  const mainLabels = { ...labels };
  delete mainLabels.spicy;

  const out = [
    "import type { CoupleTask } from '../types/game';",
    '',
    `export const QUESTION_GROUP_LABELS = ${JSON.stringify(mainLabels, null, 2)} as const;`,
    '',
    'export type QuestionGroup = keyof typeof QUESTION_GROUP_LABELS;',
    '',
    'export type CoupleQuestionTask = CoupleTask & {',
    "  kind: 'question';",
    '  questionGroup: QuestionGroup | \'meet100\' | \'intimacy\' | \'spicy\';',
    '};',
    '',
    'export const allQuestions: CoupleQuestionTask[] = [',
    tasks.map(renderQuestionItem).join(',\n'),
    '];',
    '',
    'export function getQuestionBankStats() {',
    '  const byGroup = {} as Record<string, number>;',
    '  const byCategory = {} as Record<string, number>;',
    '  const byLevel = {} as Record<string, number>;',
    '  for (const q of allQuestions) {',
    '    byGroup[q.questionGroup] = (byGroup[q.questionGroup] ?? 0) + 1;',
    '    byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;',
    '    byLevel[q.level] = (byLevel[q.level] ?? 0) + 1;',
    '  }',
    '  return { total: allQuestions.length, byGroup, byCategory, byLevel };',
    '}',
    '',
  ].join('\n');

  writeFileSync(join(projectRoot, 'src', 'data', 'allQuestions.ts'), out, 'utf8');
}

function writeMeet100(tasks) {
  const out = [
    "import type { CoupleTask } from '../types/game';",
    '',
    `export const MEET100_GROUP_LABEL = ${esc(GROUP_LABELS.meet100)};`,
    '',
    'export type Meet100QuestionTask = CoupleTask & {',
    "  kind: 'question';",
    "  questionGroup: 'meet100';",
    '};',
    '',
    'export const meet100Questions: Meet100QuestionTask[] = [',
    tasks.map(renderQuestionItem).join(',\n'),
    '];',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'src', 'data', 'meet100Questions.ts'), out, 'utf8');
}

function writeIntimacy(tasks) {
  const out = [
    "import type { CoupleTask } from '../types/game';",
    '',
    `export const INTIMACY_GROUP_LABEL = ${esc(GROUP_LABELS.intimacy)};`,
    '',
    'export type IntimacyQuestionTask = CoupleTask & {',
    "  kind: 'question';",
    "  questionGroup: 'intimacy';",
    '};',
    '',
    'export const intimacyQuestions: IntimacyQuestionTask[] = [',
    tasks.map(renderQuestionItem).join(',\n'),
    '];',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'src', 'data', 'intimacyQuestions.ts'), out, 'utf8');
}

function writeCoupleTasks(tasks) {
  const out = [
    "import type { CoupleTask } from '../types/game';",
    '',
    'export const coupleTasks: CoupleTask[] = [',
    tasks.map(renderTaskItem).join(',\n'),
    '];',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'src', 'data', 'coupleTasks.ts'), out, 'utf8');
}

function writeAllTasks(extra) {
  const out = [
    "import type { CoupleTask, TaskCategory } from '../types/game';",
    "import { coupleTasks } from './coupleTasks';",
    '',
    "const COUPLE_CATEGORIES: TaskCategory[] = ['romantic', 'calm', 'creative'];",
    "const COUPLE_KEYWORDS = ['יחד', 'ביחד', 'שניכם', 'זוגי', 'אחד לשני'];",
    '',
    'function inferCoupleTask(task: CoupleTask): boolean {',
    '  if (task.isCoupleTask !== undefined) return task.isCoupleTask;',
    '  if (COUPLE_CATEGORIES.includes(task.category)) return true;',
    "  if (task.id.startsWith('challenge-04') || task.id.startsWith('challenge-05')) return true;",
    '  return COUPLE_KEYWORDS.some((w) => task.description.includes(w));',
    '}',
    '',
    'export const extraTasks: CoupleTask[] = [',
    extra.map(renderTaskItem).join(',\n'),
    '];',
    '',
    'export const allTasks: CoupleTask[] = [...coupleTasks, ...extraTasks].map((task) => ({',
    '  ...task,',
    '  isCoupleTask: inferCoupleTask(task),',
    '}));',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'src', 'data', 'allTasks.ts'), out, 'utf8');
}

function writeMature(spicyQuestions, spicyTasks) {
  const out = [
    "import type { CoupleQuestionTask } from './allQuestions';",
    "import type { CoupleTask } from '../types/game';",
    '',
    '/** תוכן 18+ — קטגוריה spicy. נועז/חושני לזוגות בוגרים, עם אישור גיל. */',
    'export const matureTasks: CoupleTask[] = [',
    spicyTasks.map(renderTaskItem).join(',\n'),
    '];',
    '',
    'export const matureQuestions: CoupleQuestionTask[] = [',
    spicyQuestions.map(renderQuestionItem).join(',\n'),
    '];',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'src', 'data', 'matureContent.ts'), out, 'utf8');
}

const src = argSrc();
if (src !== DEFAULT_SRC) {
  copyFileSync(src, DEFAULT_SRC);
}

const { questionBuckets, regularTasks, spicyTasks } = parseBank(readFileSync(src, 'utf8'));
const mainQ = buildMainQuestions(questionBuckets);
const meet100 = buildMeet100(questionBuckets);
const intimacy = buildIntimacy(questionBuckets);
const spicyQ = buildSpicyQuestions(questionBuckets);
const { clean, legacySpicy } = splitRegularAndLegacySpicy(regularTasks);
const { couple, extra } = buildCoupleAndExtra(clean);
const spicyT = buildSpicyTasks(legacySpicy, spicyTasks);

writeAllQuestions(mainQ);
writeMeet100(meet100);
writeIntimacy(intimacy);
writeCoupleTasks(couple);
writeAllTasks(extra);
writeMature(spicyQ, spicyT);

console.log('Imported improved bank:');
console.log(`  source: ${src}`);
console.log(`  main questions: ${mainQ.length}`);
console.log(`  meet100: ${meet100.length}`);
console.log(`  intimacy: ${intimacy.length}`);
console.log(`  spicy questions: ${spicyQ.length}`);
console.log(`  couple tasks: ${couple.length}`);
console.log(`  extra tasks: ${extra.length}`);
console.log(`  spicy tasks: ${spicyT.length}`);
console.log(
  `  TOTAL questions: ${mainQ.length + meet100.length + intimacy.length + spicyQ.length}`,
);
console.log(`  TOTAL tasks: ${couple.length + extra.length + spicyT.length}`);
