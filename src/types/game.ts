export type ContentKind = 'task' | 'question';

export type ContentMode = 'tasks' | 'questions' | 'mixed';

export type TaskCategory =
  | 'funny'
  | 'romantic'
  | 'challenge'
  | 'calm'
  | 'creative'
  | 'movement'
  | 'spicy';

export type TaskLevel = 'easy' | 'normal' | 'advanced';

export type GameMode = 'funny' | 'romantic' | 'challenge' | 'calm' | 'mixed' | 'spicy';

export type Theme = 'dark' | 'light';

export type TargetScore = 5 | 10 | 15 | 'free' | 'custom';

export type GameFormat = 'quick' | 'normal' | 'full' | 'rounds' | 'fun';

export type ScoringMode = 'competitive' | 'cooperative' | 'none';

export type SpinnerStyle = 'classic' | 'glass' | 'heart';

export type FontChoice = 'heebo' | 'assistant' | 'rubik';

export type AnimationStyle = 'full' | 'reduced';

export type BgTheme = 'default' | 'purple' | 'rose' | 'ocean';

export type SoundPack = 'default' | 'soft' | 'playful';

export type Screen =
  | 'welcome'
  | 'setup'
  | 'dice-roll'
  | 'mode-select'
  | 'level-select'
  | 'tutorial'
  | 'game'
  | 'end'
  | 'settings'
  | 'admin';

export type CoupleTask = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  level: TaskLevel;
  durationSeconds?: number;
  isCoupleTask?: boolean;
  kind?: ContentKind;
  questionGroup?: string;
};

export type AppSettings = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  backgroundMusicEnabled: boolean;
  theme: Theme;
  playerOneName: string;
  playerTwoName: string;
  playerOneColor: string;
  playerTwoColor: string;
  playerOneAvatar: string;
  playerTwoAvatar: string;
  targetScore: TargetScore;
  customTargetScore: number;
  lastSelectedMode: GameMode;
  lastSelectedLevel: TaskLevel;
  lastGameFormat: GameFormat;
  lastScoringMode: ScoringMode;
  advancedTasksEnabled: boolean;
  spinnerStyle: SpinnerStyle;
  fontChoice: FontChoice;
  animationStyle: AnimationStyle;
  bgTheme: BgTheme;
  colorblindMode: boolean;
  soundPack: SoundPack;
  roundCount: number;
  coupleTaskMode: boolean;
  lastContentMode: ContentMode;
  matureAgeConfirmed: boolean;
};

export type GameStats = {
  totalCompleted: number;
  totalSkipped: number;
  streak: number;
  maxStreak: number;
  funniestTaskId: string | null;
  funniestTaskTitle: string | null;
  startTime: number;
  /** Round counter for end conditions (may equal tasks presented) */
  roundNumber: number;
  /** Distinct from scoring rounds — how many cards were shown */
  tasksPresented?: number;
};

export type GameState = {
  screen: Screen;
  mode: GameMode;
  level: TaskLevel;
  gameFormat: GameFormat;
  scoringMode: ScoringMode;
  coupleTaskMode: boolean;
  contentMode: ContentMode;
  eveningName: string;
  playerOneName: string;
  playerTwoName: string;
  currentPlayerIndex: 0 | 1;
  scores: [number, number];
  cooperativeScore: number;
  usedTaskIds: string[];
  currentTask: CoupleTask | null;
  isSpinning: boolean;
  wheelLanded: boolean;
  targetScore: TargetScore;
  customTargetScore: number;
  roundTarget: number;
  timeLimitSeconds: number | null;
  timeRemainingSeconds: number | null;
  /** Absolute deadline (Date.now-based) — timer derives remaining from wall clock */
  timeDeadlineMs: number | null;
  /** Idempotency key for finish side-effects (history/records/sound) */
  finishEventId: string | null;
  stats: GameStats;
  winner: 0 | 1 | 'tie' | null;
  spinCategory: string | null;
  unlockedAchievements: string[];
  sessionNewAchievements: string[];
  paused?: boolean;
  uiBlocked?: boolean;
  poolEmpty?: boolean;
  lastAction?: 'complete' | 'skip' | 'replace' | null;
};

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  emoji: string;
};

export type GameHistoryEntry = {
  id: string;
  date: string;
  eveningName: string;
  mode: GameMode;
  completed: number;
  skipped: number;
  winner: string | null;
  durationMinutes: number;
};

export type LocalRecords = {
  mostCompleted: number;
  longestStreak: number;
  totalGames: number;
  totalTasks: number;
};

export type SpinnerSegment = {
  label: string;
  category: TaskCategory | null;
  rare: boolean;
  questionGroup?: string;
};

export const SPINNER_SEGMENTS: SpinnerSegment[] = [
  { label: 'מצחיק', category: 'funny', rare: false },
  { label: 'זוגי', category: 'romantic', rare: false },
  { label: 'אתגר', category: 'challenge', rare: false },
  { label: 'רגוע', category: 'calm', rare: false },
  { label: 'הפתעה', category: null, rare: true },
  { label: 'תנועה', category: 'movement', rare: false },
  { label: 'יצירה', category: 'creative', rare: false },
  { label: 'מחמאה', category: 'romantic', rare: false },
];

export const QUESTION_SPINNER_SEGMENTS: SpinnerSegment[] = [
  { label: 'עמוק', category: 'romantic', rare: false },
  { label: 'מצחיק', category: 'funny', rare: false },
  { label: 'רומנטי', category: 'romantic', rare: false },
  { label: '100 שאלות', category: 'challenge', questionGroup: 'meet100', rare: false },
  { label: 'פתיחה', category: 'funny', rare: false },
  { label: 'תקשורת', category: 'calm', rare: false },
  { label: 'קרבה', category: 'romantic', questionGroup: 'intimacy', rare: false },
  { label: 'סיכום', category: 'calm', rare: true },
];

export const SPICY_SPINNER_SEGMENTS: SpinnerSegment[] = [
  { label: 'משימה', category: 'spicy', rare: false },
  { label: 'שאלה', category: 'spicy', rare: false },
  { label: 'נגיעה', category: 'spicy', rare: false },
  { label: 'רומנטי', category: 'spicy', rare: false },
  { label: 'הפתעה', category: 'spicy', rare: true },
  { label: 'שיחה', category: 'spicy', rare: false },
  { label: 'ריקוד', category: 'spicy', rare: false },
  { label: '18+', category: 'spicy', rare: false },
];

export function getSpinnerSegments(mode: GameMode, contentMode: ContentMode): SpinnerSegment[] {
  if (mode === 'spicy') return SPICY_SPINNER_SEGMENTS;
  if (contentMode === 'questions') return [...QUESTION_SPINNER_SEGMENTS];
  return [...SPINNER_SEGMENTS];
}

export const CONTENT_MODE_LABELS: Record<ContentMode, string> = {
  tasks: 'משימות בלבד',
  questions: 'שאלות בלבד',
  mixed: 'משימות + שאלות',
};

export const CONTENT_MODE_DESCRIPTIONS: Record<ContentMode, string> = {
  tasks: '180 משימות כיפיות לביצוע',
  questions: '400+ שאלות חווייתיות',
  mixed: 'שילוב אקראי של משימות ושאלות',
};

export const MODE_LABELS: Record<GameMode, string> = {
  funny: 'מצחיק',
  romantic: 'רומנטי נקי',
  challenge: 'אתגר זוגי',
  calm: 'ערב רגוע',
  mixed: 'ערב מעורב',
  spicy: '18+ 🔥',
};

export const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  funny: 'משימות קלילות, שטויות וצחוקים',
  romantic: 'משימות נעימות שמקרבות בלי להביך',
  challenge: 'משימות קצת יותר מאתגרות אבל עדיין קלילות',
  calm: 'משימות שקטות, נעימות ואווירה טובה',
  mixed: 'שילוב של כל הסוגים',
  spicy: 'תוכן נועל ופלרטטני לזוגות בוגרים — עם אישור גיל',
};

export const LEVEL_LABELS: Record<TaskLevel, string> = {
  easy: 'קליל',
  normal: 'רגיל',
  advanced: 'מתקדם',
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  funny: 'מצחיק',
  romantic: 'רומנטי',
  challenge: 'אתגר',
  calm: 'רגוע',
  creative: 'יצירתי',
  movement: 'תנועה',
  spicy: '18+',
};

export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  funny: '😂',
  romantic: '💜',
  challenge: '🏆',
  calm: '🌙',
  creative: '🎨',
  movement: '💃',
  spicy: '🔥',
};

export const GAME_FORMAT_LABELS: Record<GameFormat, string> = {
  quick: 'משחק מהיר — 5 דק׳',
  normal: 'רגיל',
  full: 'ערב מלא — 30 דק׳',
  rounds: 'לפי סיבובים',
  fun: 'בלי ניקוד — רק כיף',
};

export const GAME_FORMAT_DESCRIPTIONS: Record<GameFormat, string> = {
  quick: 'משחק קצר ומהיר, מושלם להתחלה',
  normal: 'קצב נעים עם יעד נקודות',
  full: 'ערב ארוך עם הרבה משימות',
  rounds: 'בחרו מספר סיבובים מראש',
  fun: 'בלי תחרות, רק הנאה',
};

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  competitive: 'תחרותי',
  cooperative: 'שיתוף פעולה',
  none: 'ללא ניקוד',
};

export const PLAYER_COLORS = [
  { id: 'pink', value: '#FF4FA3', label: 'ורוד' },
  { id: 'purple', value: '#8B5CF6', label: 'סגול' },
  { id: 'blue', value: '#38BDF8', label: 'כחול' },
  { id: 'gold', value: '#FACC15', label: 'זהב' },
  { id: 'teal', value: '#2DD4BF', label: 'טורקיז' },
  { id: 'rose', value: '#FB7185', label: 'ורוד עדין' },
];

export const AVATAR_OPTIONS = ['😊', '😎', '🥰', '🤩', '🦊', '🐱', '🌟', '💫', '🎭', '👑'];

export const END_PHRASES = [
  'איזה ערב זוגי מוצלח!',
  'עשיתם את זה בגדול!',
  'הכי כיף שיש — ערב מושלם!',
  'זוגיות ברמה גבוהה הערב!',
  'מחכים לסיבוב הבא יחד!',
  'צחוקים, חיבוקים, וניצחון!',
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_game', title: 'התחלה מתוקה', description: 'סיימתם משחק ראשון', emoji: '🎉' },
  { id: 'no_skips', title: 'בלי דילוגים', description: 'לא דילגתם על אף משימה', emoji: '💪' },
  { id: 'streak_5', title: 'רצף של 5', description: '5 משימות ברצף בלי דילוג', emoji: '🔥' },
  { id: 'funny_night', title: 'ערב מצחיק', description: '10+ משימות בוצעו', emoji: '😂' },
  { id: 'cooperative', title: 'צוות אחד', description: 'ניצחתם יחד במצב שיתופי', emoji: '🤝' },
  { id: 'speed_run', title: 'ספרינט זוגי', description: 'סיימתם משחק מהיר', emoji: '⚡' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  backgroundMusicEnabled: false,
  theme: 'dark',
  playerOneName: 'שחקן 1',
  playerTwoName: 'שחקן 2',
  playerOneColor: '#FF4FA3',
  playerTwoColor: '#8B5CF6',
  playerOneAvatar: '😊',
  playerTwoAvatar: '🥰',
  targetScore: 10,
  customTargetScore: 12,
  lastSelectedMode: 'mixed',
  lastSelectedLevel: 'normal',
  lastGameFormat: 'normal',
  lastScoringMode: 'competitive',
  advancedTasksEnabled: true,
  spinnerStyle: 'glass',
  fontChoice: 'heebo',
  animationStyle: 'full',
  bgTheme: 'default',
  colorblindMode: false,
  soundPack: 'default',
  roundCount: 12,
  coupleTaskMode: false,
  lastContentMode: 'mixed',
  matureAgeConfirmed: false,
};

export function getEffectiveTarget(state: Pick<GameState, 'targetScore' | 'customTargetScore' | 'gameFormat' | 'roundTarget'>): number | null {
  if (state.gameFormat === 'fun') return null;
  if (state.gameFormat === 'rounds') return state.roundTarget;
  if (state.targetScore === 'free') return null;
  if (state.targetScore === 'custom') return state.customTargetScore;
  return state.targetScore;
}

export function getTimeLimitForFormat(format: GameFormat): number | null {
  if (format === 'quick') return 5 * 60;
  if (format === 'full') return 30 * 60;
  return null;
}

export function getDefaultRoundTarget(format: GameFormat, roundCount: number): number {
  if (format === 'rounds') return roundCount;
  if (format === 'quick') return 8;
  if (format === 'full') return 20;
  return 12;
}
