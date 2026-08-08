import { CONTENT_MODE_LABELS, MODE_LABELS } from '../types/game';
import type { RobotContext, RobotReply } from '../types/robot';
import { polishPrompt } from './polishPrompt';

function p1(ctx: RobotContext) {
  return ctx.playerOneName;
}

function p2(ctx: RobotContext) {
  return ctx.playerTwoName;
}

function leader(ctx: RobotContext): 0 | 1 | 'tie' {
  const [a, b] = ctx.scores;
  if (a > b) return 0;
  if (b > a) return 1;
  return 'tie';
}

const VERDICT_OPENERS = [
  '⚖️ לאחר התייעצות עם עצמי (וזה מספיק)...',
  '⚖️ פסק דין רשמי של ספינבי:',
  '⚖️ אני שופט — אבל בחיוך:',
  '⚖️ דעתי המקצועית (אני מומחה בדברים לא חשובים):',
];

const COMPLIMENTS = [
  'אתם זוג מושלם בלי להתאמץ.',
  'יש לכם כימיה — זה ניכר גם בדילוגים.',
  'הערב הזה נראה כמו סדרה שאני רוצה לצפות בה.',
  'אתם מצחיקים יחד — וזה הכי נדיר.',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function progressPct(ctx: RobotContext): number | null {
  if (!ctx.effectiveTarget || ctx.effectiveTarget <= 0) return null;
  const cur =
    ctx.scoringMode === 'cooperative'
      ? ctx.cooperativeScore
      : ctx.scoringMode === 'competitive'
        ? Math.max(ctx.scores[0], ctx.scores[1])
        : ctx.stats.totalCompleted;
  return Math.min(100, Math.round((cur / ctx.effectiveTarget) * 100));
}

export function judgePerformance(ctx: RobotContext): RobotReply {
  const { totalCompleted, totalSkipped, streak, maxStreak } = ctx.stats;
  const skipRate = totalCompleted + totalSkipped > 0 ? totalSkipped / (totalCompleted + totalSkipped) : 0;
  const pct = progressPct(ctx);

  let grade: string;
  let mood: RobotReply['mood'] = 'judge';

  if (totalCompleted === 0) {
    return {
      mood: 'cheer',
      text: `${pick(VERDICT_OPENERS)}\n\nעדיין לא התחלתם — אבל כבר אני גאה בכם על שבאתם לשחק יחד 💜\n\nלחצו סובב ונתחיל את הערב!`,
      suggestions: ['איך משחקים?', 'האם אפשר לדלג?'],
    };
  }

  if (streak >= 5) {
    grade = 'A+ — רצף מטורף! 🔥';
    mood = 'excited';
  } else if (skipRate > 0.5) {
    grade = 'B — הרבה דילוגים, אבל זה אומר שאתם בוחרים מה נעים. מכבד.';
  } else if (totalCompleted >= 8) {
    grade = 'A — ערב פרודוקטיבי וכיפי!';
    mood = 'excited';
  } else if (totalSkipped === 0 && totalCompleted >= 3) {
    grade = 'A — בלי דילוגים! אומץ או אידיאלizm — בכל מקרה מרשים.';
  } else {
    grade = 'B+ — קצב טוב, אווירה נעימה.';
  }

  const progressLine = pct !== null ? `\n\n📊 התקדמות: ~${pct}% ליעד.` : '';
  const streakLine = streak >= 2 ? `\n🔥 רצף נוכחי: ${streak} (שיא: ${maxStreak}).` : '';

  return {
    mood,
    text: `${pick(VERDICT_OPENERS)}\n\n**ציון לערב עד כה: ${grade}**\n\n${totalCompleted} בוצעו · ${totalSkipped} דילוגים.${streakLine}${progressLine}\n\n${pick(COMPLIMENTS)}`,
    suggestions: ['מי מנצח?', 'שפוט את המשימה', 'מי יותר מצחיק?'],
  };
}

export function judgeCurrentTask(ctx: RobotContext): RobotReply {
  if (!ctx.currentTask) {
    return {
      mood: 'cheer',
      text: 'אין משימה פתוחה כרגע — סובבו את הגלגל ואשפוט מיד! 🎡',
      suggestions: ['מי בתור?', 'איך משחקים?'],
    };
  }

  const t = ctx.currentTask;
  const isQuestion = t.kind === 'question';
  const isSpicy = t.category === 'spicy';
  const isMeet100 = t.questionGroup === 'meet100';

  let verdict: string;
  if (isSpicy) {
    verdict = 'משימה/שאלה 18+ — שפוטי: **מותר, יפה ומותאם לזוג בוגר**. רק מה שנוח לשניכם.';
  } else if (isMeet100) {
    verdict = 'שאלת היכרות מאתגר 100 — **מעולה לפתיחת שיחה**. ענו בכנות, בלי לשפוט אחד את השני.';
  } else if (isQuestion) {
    verdict = 'שאלה זוגית — **אין תשובה נכונה**. הכי טוב = שיחה אמיתית. אם עניתם — כבר ניצחתם.';
  } else if (t.isCoupleTask) {
    verdict = 'משימה זוגית — **שניכם חייבים להשתתף**. אם צחקתם — ציון מלא.';
  } else {
    verdict = `משימה ל-${ctx.currentPlayerIndex === 0 ? p1(ctx) : p2(ctx)} — **תנו בראש מלא**, ואחר כך תור לשני.`;
  }

  const duration = t.durationSeconds ? `\n⏱ ${t.durationSeconds} שניות — לא לחץ, רק כיף.` : '';

  return {
    mood: 'judge',
    text: `${pick(VERDICT_OPENERS)}\n\n📋 "${t.description}"\n\n${verdict}${duration}\n\n*דילוג = 0 נקודות על הציון, 100% על הנוחות.*`,
    suggestions: ['ענינו טוב?', 'האם אפשר לדלג?', 'מי מנצח?'],
  };
}

export function judgeAnswerQuality(ctx: RobotContext, input: string): RobotReply {
  const lower = input.toLowerCase();
  const humble = /לא יודע|קשה|אולי|לא בטוח/.test(lower);
  const enthusiastic = /מעולה|כיף|אהבתי|היה/.test(lower);

  if (ctx.currentTask?.kind === 'question') {
    if (humble) {
      return {
        mood: 'cheer',
        text: `⚖️ פסק דין על התשובה:\n\n**${p1(ctx)} ו-${p2(ctx)} — כנות מנצחת.**\n\n"לא יודע/ת" זו תשובה לגיטימית ואפילו מעניינת. זה פותח שיחה, לא סוגר אותה.\n\nציון: **9/10** על אומץ.`,
        suggestions: ['שאלה נוספת?', 'מי מנצח?'],
      };
    }
    if (enthusiastic) {
      return {
        mood: 'excited',
        text: `⚖️ פסק דין:\n\n**תשובה חמה ומלאת אנרגיה!** ציון: **10/10**.\n\n${pick(COMPLIMENTS)}`,
        suggestions: ['שפוט אותנו', 'מי בתור?'],
      };
    }
    return {
      mood: 'judge',
      text: `⚖️ על השאלה "${ctx.currentTask.description.slice(0, 60)}${ctx.currentTask.description.length > 60 ? '…' : ''}":\n\nכל תשובה שגרמה לכם להסתכל אחד בשני = **ציון מלא**.\n\nאם דיברתם יותר מ-30 שניות — אתם כבר אלופים.`,
      suggestions: ['המשימה הבאה?', 'מי מנצח?'],
    };
  }

  return {
    mood: 'judge',
    text: '⚖️ על משימות ביצוע: אם עשיתם (או ניסיתם) — **עברתם**. המשיכו!',
    suggestions: ['שפוט את המשימה', 'מי מנצח?'],
  };
}

export function judgeChemistry(ctx: RobotContext): RobotReply {
  const { totalCompleted, totalSkipped, maxStreak } = ctx.stats;
  const names = `${p1(ctx)} & ${p2(ctx)}`;

  let vibe: string;
  if (ctx.coupleTaskMode) {
    vibe = 'מצב זוגי פעיל — **אנרגיה של צוות**. אוהב לראות את זה.';
  } else if (totalSkipped === 0 && totalCompleted >= 4) {
    vibe = '**זרימה מושלמת** — כמעט בלי דילוגים. כימיה גבוהה.';
  } else if (maxStreak >= 4) {
    vibe = '**רצף חזק** — אתם בקצב של זוג שמכיר את עצמו.';
  } else if (totalSkipped > totalCompleted) {
    vibe = 'הרבה דילוגים — **אולי הקצב מהיר מדי?** נסו מצב "בלי לחץ".';
  } else {
    vibe = '**אווירה רגועה ונעימה** — בדיוק מה שצריך לערב זוגי.';
  }

  return {
    mood: 'love',
    text: `💜 ניתוח כימיה: **${names}**\n\n${vibe}\n\nמצב: ${MODE_LABELS[ctx.mode]} · ${CONTENT_MODE_LABELS[ctx.contentMode ?? 'mixed']}\n\n${pick(COMPLIMENTS)}`,
    suggestions: ['מי מנצח?', 'ציון לערב', 'שפוט את המשימה'],
  };
}

export function judgeWhoIsFunnier(ctx: RobotContext): RobotReply {
  if (ctx.stats.funniestTaskTitle) {
    const fav = Math.random() > 0.5 ? 0 : 1;
    const winner = fav === 0 ? p1(ctx) : p2(ctx);
    const other = fav === 0 ? p2(ctx) : p1(ctx);
    return {
      mood: 'excited',
      text: `😂 שיפוט הומור:\n\nהמשימה הכי מצחיקה: "${polishPrompt(ctx.stats.funniestTaskTitle)}"\n\n**${winner}** — לדעתי יותר מצחיק/ה הערב (ב-53% ביטחון סטטיסטי).\n**${other}** — גם את/ה היית מעולה, אל תקפא/י 😄`,
      suggestions: ['מי מנצח?', 'ציון לערב'],
    };
  }

  const coin = Math.random() > 0.5 ? 0 : 1;
  const winner = coin === 0 ? p1(ctx) : p2(ctx);
  return {
    mood: 'judge',
    text: `😂 אין עדיין "משימה מצחיקה" מסומנת — אז אשפוט בחוכמה:\n\n**${winner}** נראה/ית יותר מצחיק/ה הערב.\n\n(לחצו 😂 על משימה כדי שאשפוט מדעית יותר.)`,
    suggestions: ['איך מסמנים מצחיקה?', 'מי מנצח?'],
  };
}

export function getEncouragement(ctx: RobotContext): RobotReply {
  const lines = [
    `💪 ${p1(ctx)} ו-${p2(ctx)} — אתם עושים את זה מעולה!`,
    '🌟 כל משימה קטנה = זיכרון גדול. המשיכו!',
    '✨ הערב הזה שייך לכם — בלי השוואות, רק כיף.',
    '🎉 דילוג זה לא כישלון — זה גבול בריא.',
  ];
  const pct = progressPct(ctx);
  const extra = pct !== null && pct >= 80 ? '\n\n🏁 כמעט אצל היעד — עוד קצת!' : '';

  return {
    mood: 'cheer',
    text: pick(lines) + extra,
    suggestions: ['מי מנצח?', 'שפוט אותנו', 'ציון לערב'],
  };
}

export function judgeRomanticMoment(ctx: RobotContext): RobotReply {
  const romantic = ctx.mode === 'romantic' || ctx.mode === 'spicy' || ctx.currentTask?.category === 'romantic';
  if (romantic) {
    return {
      mood: 'love',
      text: `💜 **${p1(ctx)}** ו-**${p2(ctx)}** — הרגע הזה רומנטי מספיק בשבילי.\n\nטיפ שופט: עין בעין 3 שניות = +100 נקודות רומנטיקה (לא רשמיות).`,
      suggestions: ['ציון לערב', 'מי מנצח?'],
    };
  }
  return {
    mood: 'cheer',
    text: 'עדיין לא במצב רומנטי — אבל **רומנטיקה זה גם צחוק יחד**. אתם בכיוון הנכון.',
    suggestions: ['איך בוחרים מצב?', 'שפוט אותנו'],
  };
}

export function smartContextHint(ctx: RobotContext): RobotReply | null {
  if (ctx.screen === 'welcome') {
    return {
      mood: 'cheer',
      text: '👋 ברוכים הבאים! אני **ספינבי** — השופט הכי נחמד בעולם.\n\nלחצו **בואו נשחק** ואני אהיה כאן לכל שאלה (ולמחלוקות 😉).',
      suggestions: ['איך משחקים?', 'שפוט אותנו', 'מה יש במשחק?'],
    };
  }
  if (ctx.screen === 'setup') {
    return {
      mood: 'happy',
      text: `⚙️ בוחרים וייב?\n\n**טיפ שופט:** מצב "בלי לחץ" מושלם לערב ראשון.\n**אתגר 100 שאלות** — מעולה להיכרות!\n\nאני כאן אם מתלבטים.`,
      suggestions: ['מה ההבדל בין מצבים?', 'מה זה 100 שאלות?', 'איך משחקים?'],
    };
  }
  if (ctx.screen === 'dice-roll') {
    return {
      mood: 'excited',
      text: '🎲 **קובייה!** מי שמקבל יותר גבוה — מתחיל.\n\nתיקו? תזרקו שוב. זה חוק הטבע (וגם של המשחק).',
      suggestions: ['מי מנצח?', 'איך משחקים?'],
    };
  }
  if (ctx.screen === 'end') {
    return judgePerformance({ ...ctx, stats: { ...ctx.stats } });
  }
  return null;
}

export function enhancedWinnerJudge(ctx: RobotContext): RobotReply {
  if (ctx.screen === 'end' && ctx.winner !== null) {
    if (ctx.winner === 'tie') {
      return {
        mood: 'judge',
        text: `⚖️ **פסק דין סופי:** תיקו!\n\n${p1(ctx)} ו-${p2(ctx)} — שניכם ניצחתם את הערב.\n\n${ctx.stats.totalCompleted} משימות · הכי חשוב: היה כיף.`,
        suggestions: ['שחקו שוב', 'ציון לערב'],
      };
    }
    const w = ctx.winner === 0 ? p1(ctx) : p2(ctx);
    const l = ctx.winner === 0 ? p2(ctx) : p1(ctx);
    const margin = Math.abs(ctx.scores[0] - ctx.scores[1]);
    const roast =
      margin === 1
        ? 'ניצחון בנקודה אחת — דרמטי!'
        : margin >= 5
          ? 'פער משמעותי — אבל המפסיד/ה עדיין אגדה.'
          : 'מרתק עד הסוף.';

    return {
      mood: 'judge',
      text: `⚖️ **פסק דין סופי:** ${w} מנצח/ת! 🏆\n\n${l} — ${roast}\n\n${ctx.stats.totalCompleted} בוצעו · ${ctx.stats.totalSkipped} דילוגים.\n\n*ערעור? רק עם חיבוק.*`,
      suggestions: ['שחקו שוב', 'מי היה מצחיק?'],
    };
  }

  const lead = leader(ctx);
  if (lead === 'tie') {
    return {
      mood: 'judge',
      text: `⚖️ **${p1(ctx)} ${ctx.scores[0]} : ${ctx.scores[1]} ${p2(ctx)}** — תיקו!\n\nהמתח אמיתי. הסיבוב הבא יכריע.`,
      suggestions: ['מי בתור?', 'ציון לערב'],
    };
  }
  const w = lead === 0 ? p1(ctx) : p2(ctx);
  const l = lead === 0 ? p2(ctx) : p1(ctx);
  const diff = Math.abs(ctx.scores[0] - ctx.scores[1]);
  return {
    mood: 'judge',
    text: `⚖️ **${w}** מוביל/ה ${ctx.scores[lead]}:${ctx.scores[lead === 0 ? 1 : 0]}${ctx.effectiveTarget ? ` (יעד ${ctx.effectiveTarget})` : ''}.\n\n${diff === 1 ? 'נקודה אחת — הכל פתוח!' : `${l}, יש לך/י מה לעשות 😉`}\n\n*החלטה ניתנת לערעור בצחוק.*`,
    suggestions: ['מי בתור?', 'שפוט את המשימה', 'מי מצחיק יותר?'],
  };
}
