import type {
  ContentMode,
  CoupleTask,
  GameFormat,
  GameMode,
  ScoringMode,
  Screen,
  TargetScore,
  TaskLevel,
} from '../types/game';

export type GameEvent =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'SET_LEVEL'; level: TaskLevel }
  | { type: 'SET_FORMAT'; format: GameFormat }
  | { type: 'SET_SCORING'; scoring: ScoringMode }
  | { type: 'SET_COUPLE_MODE'; enabled: boolean }
  | { type: 'SET_CONTENT_MODE'; contentMode: ContentMode }
  | { type: 'SET_PLAYER_NAMES'; one: string; two: string }
  | { type: 'SET_EVENING_NAME'; name: string }
  | { type: 'SET_TARGET'; target: TargetScore }
  | { type: 'SET_CUSTOM_TARGET'; value: number }
  | { type: 'SET_ROUND_COUNT'; value: number }
  | { type: 'APPLY_PRESET'; preset: GamePreset }
  | { type: 'GO_DICE' }
  | { type: 'START_GAME'; firstPlayer: 0 | 1; roundCount: number; finishEventId?: string }
  | { type: 'START_SPIN' }
  | { type: 'SPIN_LANDED'; task: CoupleTask; label: string }
  | { type: 'TASK_COMPLETED'; finishEventId: string }
  | { type: 'TASK_SKIPPED'; finishEventId: string }
  | { type: 'TASK_REPLACED'; usedId: string; next: CoupleTask }
  | { type: 'MARK_FUNNIEST'; task: CoupleTask }
  | { type: 'TIMER_EXPIRED'; finishEventId: string }
  | { type: 'GAME_FINISHED'; winner: 0 | 1 | 'tie'; finishEventId: string }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'UNDO_LAST' }
  | { type: 'RESTORE_SNAPSHOT'; snapshot: import('../types/game').GameState }
  | { type: 'NEW_GAME'; settingsNames: { one: string; two: string; contentMode: ContentMode } }
  | { type: 'PLAY_AGAIN' }
  | { type: 'RESET_SCORES' }
  | { type: 'SET_TIMER_REMAINING'; seconds: number }
  | { type: 'BLOCK_UI'; blocked: boolean }
  | { type: 'SET_POOL_EMPTY'; empty: boolean };

export type GamePreset = {
  id: string;
  label: string;
  mode: GameMode;
  contentMode: ContentMode;
  gameFormat: GameFormat;
  level: TaskLevel;
  scoringMode: ScoringMode;
  targetScore: TargetScore;
};

export const GAME_PRESETS: GamePreset[] = [
  {
    id: 'quick10',
    label: '10 דקות',
    mode: 'mixed',
    contentMode: 'mixed',
    gameFormat: 'quick',
    level: 'easy',
    scoringMode: 'none',
    targetScore: 'free',
  },
  {
    id: 'calm-evening',
    label: 'ערב רגוע',
    mode: 'calm',
    contentMode: 'questions',
    gameFormat: 'normal',
    level: 'easy',
    scoringMode: 'none',
    targetScore: 'free',
  },
  {
    id: 'funny-only',
    label: 'מצחיק בלבד',
    mode: 'funny',
    contentMode: 'tasks',
    gameFormat: 'fun',
    level: 'normal',
    scoringMode: 'none',
    targetScore: 'free',
  },
];

export type GameEffect =
  | { type: 'sound'; name: 'success' | 'skip' | 'start' | 'spin' }
  | { type: 'vibrate'; pattern: number[] }
  | { type: 'persist_finish'; finishEventId: string }
  | { type: 'persist_settings'; patch: Record<string, unknown> }
  | { type: 'persist_snapshot' }
  | { type: 'clear_snapshot' };
