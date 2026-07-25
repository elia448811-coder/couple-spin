import type { GameMode, GameFormat, ScoringMode, ContentMode } from '../types/game';
import { GAME_PRESETS, type GamePreset } from './gameEvents';

const TWISTS = [
  { label: '✨ ערב הפתעה', eveningTitle: 'ערב הפתעה', emoji: '✨' },
  { label: '🌙 לילה רגוע', eveningTitle: 'לילה רגוע', emoji: '🌙' },
  { label: '🔥 נועז בטעם', eveningTitle: 'נועז בטעם', emoji: '🔥' },
  { label: '🎭 תיאטרון זוגי', eveningTitle: 'תיאטרון זוגי', emoji: '🎭' },
  { label: '💬 רק שאלות עמוקות', eveningTitle: 'שאלות עמוקות', emoji: '💬' },
  { label: '🎲 הכל אקראי', eveningTitle: 'הכל אקראי', emoji: '🎲' },
];

const MODES: GameMode[] = ['funny', 'romantic', 'challenge', 'calm', 'mixed'];
const FORMATS: GameFormat[] = ['quick', 'normal', 'fun', 'rounds'];
const SCORING: ScoringMode[] = ['cooperative', 'none', 'competitive'];
const CONTENT: ContentMode[] = ['tasks', 'questions', 'mixed'];

export type SurpriseEvening = GamePreset & {
  eveningTitle: string;
  twist: string;
  surpriseMessage: string;
};

export function generateSurpriseEvening(): SurpriseEvening {
  const twist = TWISTS[Math.floor(Math.random() * TWISTS.length)]!;
  const base = GAME_PRESETS[Math.floor(Math.random() * GAME_PRESETS.length)]!;
  const mode = MODES[Math.floor(Math.random() * MODES.length)]!;
  const gameFormat = FORMATS[Math.floor(Math.random() * FORMATS.length)]!;
  const scoringMode = SCORING[Math.floor(Math.random() * SCORING.length)]!;
  const contentMode = CONTENT[Math.floor(Math.random() * CONTENT.length)]!;

  const messages = [
    'הערב הזה נבנה במיוחד בשבילכם — בלי לחשוב יותר מדי.',
    'הפתעה קטנה שיכולה להפוך לערב גדול.',
    'תנו לגלגל להחליט — אתם רק צריכים להיות פתוחים.',
    'מצב ספונטני: פחות תכנון, יותר חיבור.',
  ];

  return {
    ...base,
    id: `surprise-${Date.now()}`,
    label: twist.label,
    mode,
    gameFormat,
    scoringMode,
    contentMode,
    eveningTitle: twist.eveningTitle,
    twist: twist.emoji,
    surpriseMessage: messages[Math.floor(Math.random() * messages.length)]!,
  };
}

export function buildEveningRecap(game: {
  stats: { totalCompleted: number; totalSkipped: number; maxStreak: number };
  eveningName: string;
  contentMode: ContentMode;
  sparkStreak?: number;
}): { title: string; lines: string[] } {
  const completed = game.stats.totalCompleted;
  const skipped = game.stats.totalSkipped;
  const streak = game.stats.maxStreak;
  const title = game.eveningName || 'סיכום הערב';
  const lines = [
    `${completed} ${game.contentMode === 'questions' ? 'שאלות שנענו' : 'משימות שבוצעו'}`,
    skipped > 0 ? `${skipped} דילוגים — זה בסדר גמור` : 'בלי דילוגים — מרשים!',
    streak > 1 ? `רצף ניצחונות: ${streak} 🔥` : 'התחלה חדשה לרצף הבא',
    game.sparkStreak && game.sparkStreak > 2
      ? `ניצוץ זוגי: ${game.sparkStreak} ברצף ✨`
      : 'כל רגע קטן נספר',
  ];
  return { title, lines };
}
