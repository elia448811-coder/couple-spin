import {
  CONTENT_MODE_LABELS,
  GAME_FORMAT_LABELS,
  LEVEL_LABELS,
  MODE_LABELS,
  SCORING_MODE_LABELS,
} from '../types/game';
import type { RobotContext, RobotReply } from '../types/robot';
import {
  enhancedWinnerJudge,
  getEncouragement,
  judgeAnswerQuality,
  judgeChemistry,
  judgeCurrentTask,
  judgePerformance,
  judgeRomanticMoment,
  judgeWhoIsFunnier,
  smartContextHint,
} from './robotJudge';
import { getFullBankStats } from './taskSelection';

const DEFAULT_SUGGESTIONS = [
  '⚖️ שפוט אותנו!',
  'ציון לערב',
  'איך משחקים?',
  'האם אפשר לדלג?',
  'מי מנצח עכשיו?',
  'מי יותר מצחיק?',
];

type Intent = {
  id: string;
  patterns: string[];
  weight?: number;
  reply: (ctx: RobotContext, input: string) => RobotReply;
};

function normalize(text: string): string {
  return text
    .trim()
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s?!.,]/g, '')
    .replace(/\s+/g, ' ');
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

function playerName(ctx: RobotContext, index: 0 | 1): string {
  return index === 0 ? ctx.playerOneName : ctx.playerTwoName;
}

function currentPlayer(ctx: RobotContext): string {
  return playerName(ctx, ctx.currentPlayerIndex);
}

function judgeWinner(ctx: RobotContext): RobotReply {
  if (ctx.scoringMode === 'cooperative') {
    return {
      mood: 'judge',
      text: `⚖️ במצב שיתופי אין מנצח אחד — אתם צוות!\n\nניקוד משותף: ${ctx.cooperativeScore}${ctx.effectiveTarget ? ` / ${ctx.effectiveTarget}` : ''}.\n${ctx.cooperativeScore >= (ctx.effectiveTarget ?? 999) ? 'כמעט שם! המשיכו יחד 💪' : 'עוד קצת ותשברו שיא זוגי!'}`,
      suggestions: ['ציון לערב', 'האם אפשר לדלג?'],
    };
  }

  if (ctx.scoringMode === 'none') {
    return {
      mood: 'judge',
      text: `⚖️ במצב בלי ניקוד אין מנצח — רק כיף!\n\nעד כה: ${ctx.stats.totalCompleted} בוצעו, ${ctx.stats.totalSkipped} דילוגים.\nהמנצח האמיתי? הערב שלכם 😄`,
      suggestions: ['ציון לערב', 'מה זה מצב כיף?'],
    };
  }

  return enhancedWinnerJudge(ctx);
}

function judgeFairness(ctx: RobotContext, input: string): RobotReply {
  const wantsApology = includesAny(input, ['צודק', 'צודקת', 'אשמה', 'אשם', 'בצדק']);
  const aboutSkip = includesAny(input, ['דילג', 'דילגת', 'דילגו', 'לדלג', 'דילוג']);

  if (aboutSkip) {
    return {
      mood: 'judge',
      text: `⚖️ בנושא דילוגים:\n\n1. דילוג תמיד מותר — זה חלק מהמשחק.\n2. משימה לא נעימה? דלגו בלי רגשות אשם.\n3. ${ctx.stats.totalSkipped} דילוגים עד כה — ${ctx.stats.totalSkipped > 5 ? 'קצת הרבה, אבל זה בסדר' : 'כמות סבירה'}.\n\nפסק דין: שניכם צודקים שרוצים להרגיש בנוח.`,
      suggestions: ['מי בתור?', 'ציון לערב'],
    };
  }

  if (wantsApology) {
    const favored = Math.random() > 0.5 ? 0 : 1;
    const name = playerName(ctx, favored as 0 | 1);
    const other = playerName(ctx, favored === 0 ? 1 : 0);
    return {
      mood: 'judge',
      text: `⚖️ שמעתי את שני הצדדים...\n\n**${name}** צודק/ת ב-60%.\n**${other}** — גם את/ה קרוב/ה לאמת.\n\nהמלצת ביניים: חיבוק, משימה קלה, והלאה.`,
      suggestions: ['מי מנצח?', 'ציון לערב'],
    };
  }

  return {
    mood: 'judge',
    text: `⚖️ אני שופט נחמד — לא עורך דין!\n\nכלל הזהב:\n• נעים לשניכם = ממשיכים\n• לא נעים = דילוג\n• ויכוח = שניכם צודקים חלקית\n\nתנו פרטים ואשפוט לעומק.`,
    suggestions: ['מי צודק?', 'שפוט מי מנצח', 'ציון לערב'],
  };
}

const INTENTS: Intent[] = [
  {
    id: 'greet',
    patterns: ['שלום', 'היי', 'הי', 'בוקר', 'ערב', 'מה נשמע', 'מה קורה', 'הלו', 'אהלן'],
    reply: () => ({
      mood: 'cheer',
      text: 'היי! 👋 אני **ספינבי** — השופט הכי נחמד של ספין זוגי.\n\nאני כאן ל:\n⚖️ שיפוט הוגן (ובעיקר מצחיק)\n💬 הסבר על המשחק\n💜 עידוד כשצריך\n\nמה תרצו?',
      suggestions: DEFAULT_SUGGESTIONS,
    }),
  },
  {
    id: 'encourage',
    patterns: ['עודד', 'עידוד', 'קשה לנו', 'משעמם', 'לא בכיף', 'תחזק', 'בוא נ'],
    weight: 2,
    reply: (ctx) => getEncouragement(ctx),
  },
  {
    id: 'grade-evening',
    patterns: ['ציון', 'ציון לערב', 'איך אנחנו', 'איך הערב', 'דרג', 'דירוג', 'כמה נותנים'],
    weight: 3,
    reply: (ctx) => judgePerformance(ctx),
  },
  {
    id: 'judge-task',
    patterns: ['שפוט את המשימה', 'המשימה', 'השאלה', 'מה דעתך על', 'ענינו טוב', 'ענינו נכון', 'ביצענו טוב'],
    weight: 3,
    reply: (ctx, input) => {
      if (includesAny(input, ['ענינו', 'תשובה', 'טוב', 'נכון'])) return judgeAnswerQuality(ctx, input);
      return judgeCurrentTask(ctx);
    },
  },
  {
    id: 'chemistry',
    patterns: ['כימיה', 'מתאימים', 'זוג טוב', 'אהבה', 'קרובים'],
    weight: 2,
    reply: (ctx) => judgeChemistry(ctx),
  },
  {
    id: 'romantic-judge',
    patterns: ['רומנטי', 'רומנטיקה', '18', 'spicy', 'נועז', 'נועל'],
    reply: (ctx) => judgeRomanticMoment(ctx),
  },
  {
    id: 'how-to-play',
    patterns: ['איך משחקים', 'איך לשחק', 'מה עושים', 'הסבר', 'כללים', 'איך זה עובד', 'מה המשחק'],
    weight: 2,
    reply: () => ({
      mood: 'cheer',
      text: `📖 **איך משחקים — בקצרה:**\n\n1️⃣ בוחרים וייב (מצחיק / רומנטי / 100 שאלות / 18+...)\n2️⃣ 🎲 קובייה — מי מתחיל\n3️⃣ 🎡 מסובבים את הגלגל\n4️⃣ משימה או שאלה — מבצעים, מחליפים, או **דילוג** (תמיד OK!)\n5️⃣ נהנים 🎉`,
      suggestions: ['האם אפשר לדלג?', 'מה זה 100 שאלות?', 'שפוט אותנו!'],
    }),
  },
  {
    id: 'skip',
    patterns: ['לדלג', 'דילוג', 'דלג', 'אפשר לדלג', 'חייב', 'חייבים'],
    weight: 2,
    reply: () => ({
      mood: 'wink',
      text: '✅ **כן!** דילוג תמיד מותר.\n\nהמשחק בנוי על כיף ובטיחות. לא מתאים? דלגו בלי אשמה.\n\nיש גם "משימה אחרת" ו"קל/קשה מדי".',
      suggestions: ['מי בתור?', 'שפוט אותנו', 'ציון לערב'],
    }),
  },
  {
    id: 'meet100',
    patterns: ['100 שאלות', 'מאה שאלות', 'אתגר 100', 'היכרות', 'meet100'],
    weight: 2,
    reply: () => ({
      mood: 'happy',
      text: '🎯 **אתגר 100 שאלות** — 100 שאלות היכרות כיפיות!\n\nבמצב שאלות, סובבו ל"100 שאלות" בגלגל.\n\nאין תשובה נכונה — רק שיחה טובה. אני שופט: **כנות מנצחת.**',
      suggestions: ['איך משחקים?', 'האם אפשר לדלג?'],
    }),
  },
  {
    id: 'spicy-mode',
    patterns: ['18', 'בוגר', 'spicy', 'נועז', 'נועל', 'מבוגרים'],
    reply: () => ({
      mood: 'wink',
      text: '🔥 **מצב 18+** — תוכן נועז לזוגות בוגרים.\n\nנדרש אישור גיל · בלי לחץ · תמיד אפשר לדלג.\n\nשופט ספינבי: **רק מה שנוח לשניכם.**',
      suggestions: ['איך משחקים?', 'האם אפשר לדלג?'],
    }),
  },
  {
    id: 'couple-task',
    patterns: ['משימה זוגית', 'זוגית', 'שנינו', 'ביחד', 'מצב זוגי'],
    reply: (ctx) => ({
      mood: 'love',
      text: ctx.coupleTaskMode
        ? '💑 **מצב זוגי פעיל!** משימות לשניכם — בלי תורות. מושלם לערב קרוב.'
        : '💑 משימה זוגית = שניכם יחד.\n\nהפעילו "רק משימות/שאלות זוגיות" בהגדרות מתקדמות.',
      suggestions: ['איך משחקים?', 'שפוט אותנו'],
    }),
  },
  {
    id: 'modes',
    patterns: ['מצב', 'מצחיק', 'רומנטי', 'אתגר', 'רגוע', 'מעורב', 'הבדל', 'וייב'],
    reply: (ctx) => ({
      mood: 'neutral',
      text: `🎭 **מצבים:**\n\n• ${MODE_LABELS.funny}\n• ${MODE_LABELS.romantic}\n• ${MODE_LABELS.challenge}\n• ${MODE_LABELS.calm}\n• ${MODE_LABELS.mixed}\n• ${MODE_LABELS.spicy}\n\nכרגע: **${MODE_LABELS[ctx.mode]}** · ${LEVEL_LABELS[ctx.level]}`,
      suggestions: ['מה זה 100 שאלות?', 'איך משחקים?'],
    }),
  },
  {
    id: 'format',
    patterns: ['פורמט', 'מהיר', '30 דק', '5 דק', 'סיבובים', 'בלי ניקוד', 'כיף', 'זמן'],
    reply: (ctx) => ({
      mood: 'neutral',
      text: `⏱️ **משך משחק:**\n\n• מהיר (~10 דק)\n• רגיל\n• בלי לחץ — ללא ניקוד\n\nכרגע: ${GAME_FORMAT_LABELS[ctx.gameFormat]} · ${SCORING_MODE_LABELS[ctx.scoringMode]}`,
      suggestions: ['מי מנצח?', 'ציון לערב'],
    }),
  },
  {
    id: 'scoring',
    patterns: ['ניקוד', 'נקודות', 'נקודה', 'מנצח', 'לנצח', 'יעד', 'תחרות'],
    weight: 1,
    reply: (ctx, input) => {
      if (includesAny(input, ['מנצח', 'מנצחת', 'מוביל', 'זוכה'])) return judgeWinner(ctx);
      return {
        mood: 'neutral',
        text: `🏆 **ניקוד:**\n\n• תחרותי — נקודה למבצע\n• שיתופי — צוות\n• ללא — רק כיף\n\nכרגע: ${SCORING_MODE_LABELS[ctx.scoringMode]}`,
        suggestions: ['מי מנצח?', 'ציון לערב'],
      };
    },
  },
  {
    id: 'turn',
    patterns: ['תור', 'מי משחק', 'מי עכשיו', 'למי התור', 'תור של מי', 'מי בתור'],
    weight: 2,
    reply: (ctx) => {
      if (ctx.screen !== 'game') {
        return { mood: 'cheer', text: 'עדיין לא במשחק — לחצו **בואו נשחק** ונתחיל! 🎡', suggestions: ['איך משחקים?'] };
      }
      if (ctx.coupleTaskMode || ctx.currentTask?.isCoupleTask || ctx.currentTask?.kind === 'question') {
        return {
          mood: 'love',
          text: `💑 **${ctx.playerOneName}** ו-**${ctx.playerTwoName}** — שניכם! משימה/שאלה זוגית.`,
          suggestions: ['שפוט את המשימה', 'ציון לערב'],
        };
      }
      return {
        mood: 'wink',
        text: `🎯 התור של: **${currentPlayer(ctx)}**\n\n${ctx.currentTask ? 'יש משימה פתוחה — בצעו או דלגו.' : 'לחצו "סובב"!'}`,
        suggestions: ['מי מנצח?', 'האם אפשר לדלג?'],
      };
    },
  },
  {
    id: 'task-count',
    patterns: ['כמה משימות', 'מאגר', 'כמה יש', 'מספר', 'כמה שאלות', 'כמה תוכן', 'מה יש במשחק'],
    reply: (ctx) => {
      const bank = getFullBankStats(ctx.contentMode ?? 'mixed');
      return {
        mood: 'excited',
        text: `📚 **המאגר:**\n\n• ${bank.tasks} משימות\n• ${bank.questions} שאלות\n• **${bank.total}** סה"כ!\n\nכולל: אתגר 100 שאלות · מצב 18+ · 11 קטגוריות\n\nכרגע: ${CONTENT_MODE_LABELS[ctx.contentMode ?? 'mixed']}`,
        suggestions: ['מה זה 100 שאלות?', 'איך משחקים?'],
      };
    },
  },
  {
    id: 'questions-mode',
    patterns: ['שאלות', 'שאלה', 'עומק', 'סוג תוכן'],
    reply: (ctx) => ({
      mood: 'happy',
      text: `💬 **תוכן:**\n\n• משימות · שאלות · מעורב\n• **אתגר 100 שאלות** 🎯\n• **18+** 🔥\n\nכרגע: **${CONTENT_MODE_LABELS[ctx.contentMode ?? 'mixed']}**`,
      suggestions: ['מה זה 100 שאלות?', 'שפוט אותנו!'],
    }),
  },
  {
    id: 'streak',
    patterns: ['רצף', 'סטריק', 'streak'],
    reply: (ctx) => ({
      mood: ctx.stats.streak >= 3 ? 'excited' : 'happy',
      text:
        ctx.stats.streak >= 2
          ? `🔥 רצף: **${ctx.stats.streak}**! שיא: ${ctx.stats.maxStreak}.\n\n${ctx.stats.streak >= 5 ? 'אגדה! 🏆' : 'המשיכו!'}`
          : `שיא רצף הערב: ${ctx.stats.maxStreak}. דילוג מאפס רצף — זה OK.`,
      suggestions: ['ציון לערב', 'מי מנצח?'],
    }),
  },
  {
    id: 'current-task',
    patterns: ['משימה נוכחית', 'מה המשימה', 'מה לעשות', 'מה עכשיו'],
    reply: (ctx) => judgeCurrentTask(ctx),
  },
  {
    id: 'judge-win',
    patterns: ['מי מנצח', 'מי מנצחת', 'מי מוביל', 'מי זוכה', 'תשפוט מי מנצח'],
    weight: 3,
    reply: (ctx) => judgeWinner(ctx),
  },
  {
    id: 'judge-funny',
    patterns: ['מי מצחיק', 'מצחיק יותר', 'הכי מצחיק', 'יותר מצחיק'],
    weight: 2,
    reply: (ctx) => judgeWhoIsFunnier(ctx),
  },
  {
    id: 'judge',
    patterns: [
      'שפוט',
      'שופט',
      'פסק דין',
      'תשפוט',
      'תחליט',
      'מחלוקת',
      'ויכוח',
      'צודק',
      'צודקת',
      'לא הוגן',
      'רמאי',
      'שפוט אותנו',
      'שפטו',
    ],
    weight: 4,
    reply: (ctx, input) => {
      if (includesAny(input, ['ציון', 'דרג', 'איך אנחנו'])) return judgePerformance(ctx);
      if (includesAny(input, ['מנצח', 'מוביל', 'זוכה'])) return judgeWinner(ctx);
      if (includesAny(input, ['מצחיק', 'צחוק'])) return judgeWhoIsFunnier(ctx);
      if (includesAny(input, ['משימה', 'שאלה', 'ענינו'])) return judgeCurrentTask(ctx);
      return judgeFairness(ctx, input);
    },
  },
  {
    id: 'thanks',
    patterns: ['תודה', 'תודה רבה', 'מעולה', 'אחלה', 'כיף', 'אהבתי'],
    reply: () => ({
      mood: 'love',
      text: 'בכיף! 💜 אני תמיד כאן — לחצו על 🤖 בכל מסך.',
      suggestions: DEFAULT_SUGGESTIONS,
    }),
  },
  {
    id: 'who-are-you',
    patterns: ['מי אתה', 'מי את', 'מה אתה', 'ספינבי', 'רובוט', 'בוט'],
    reply: () => ({
      mood: 'wink',
      text: 'אני **ספינבי** 🤖⚖️\n\nהשופט הכי נחמד, העוזר הכי חכם, והמעודד הכי טוב של ספין זוגי.\n\nשאלו, בקשו שיפוט, או לחצו על ההצעות למטה!',
      suggestions: DEFAULT_SUGGESTIONS,
    }),
  },
];

function scoreIntent(intent: Intent, input: string): number {
  let score = 0;
  for (const pattern of intent.patterns) {
    if (input.includes(pattern)) {
      score += (intent.weight ?? 1) * pattern.length;
    }
  }
  return score;
}

export function getWelcomeReply(ctx?: RobotContext): RobotReply {
  const hint = ctx ? smartContextHint(ctx) : null;
  if (hint) return hint;

  return {
    mood: 'cheer',
    text: 'היי! 👋 אני **ספינבי** — השופט והחבר הכי טוב שלכם.\n\n⚖️ שאלו אותי · בקשו שיפוט · לחצו על ההצעות\n\nאני כאן לכל דבר!',
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export function askRobot(input: string, ctx: RobotContext): RobotReply {
  const normalized = normalize(input);
  if (!normalized) {
    return {
      mood: 'cheer',
      text: 'לא שמעתי — כתבו שאלה או לחצו על הצעה למטה 😊',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  let best: { intent: Intent; score: number } | null = null;

  for (const intent of INTENTS) {
    const score = scoreIntent(intent, normalized);
    if (score > 0 && (!best || score > best.score)) {
      best = { intent, score };
    }
  }

  if (best) {
    return best.intent.reply(ctx, normalized);
  }

  if (ctx.screen === 'game' && ctx.currentTask) {
    return judgeCurrentTask(ctx);
  }

  return {
    mood: 'thinking',
    text: `הממ... "${input}" — לא בטוח.\n\nנסו:\n⚖️ "שפוט אותנו"\n📊 "ציון לערב"\n🎯 "מי בתור?"\n\nאו לחצו הצעה:`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export { judgePerformance, judgeCurrentTask, smartContextHint };
