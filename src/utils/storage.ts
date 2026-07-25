import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type GameHistoryEntry,
  type LocalRecords,
} from '../types/game';

const SETTINGS_KEY = 'couple-spin-settings';
const HISTORY_KEY = 'couple-spin-history';
const RECORDS_KEY = 'couple-spin-records';
const ACHIEVEMENTS_KEY = 'couple-spin-achievements';
const SCHEMA_VERSION = 1;

const MODES = new Set(['funny', 'romantic', 'challenge', 'calm', 'mixed', 'spicy']);
const LEVELS = new Set(['easy', 'normal', 'advanced']);
const THEMES = new Set(['dark', 'light']);
const CONTENT = new Set(['tasks', 'questions', 'mixed']);

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asString(v: unknown, fallback: string, max = 80): string {
  if (typeof v !== 'string') return fallback;
  return v.trim().slice(0, max) || fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asNumber(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSettings(raw: unknown): AppSettings {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  return {
    ...base,
    soundEnabled: asBool(o.soundEnabled, base.soundEnabled),
    vibrationEnabled: asBool(o.vibrationEnabled, base.vibrationEnabled),
    backgroundMusicEnabled: asBool(o.backgroundMusicEnabled, base.backgroundMusicEnabled),
    theme: THEMES.has(String(o.theme)) ? (o.theme as AppSettings['theme']) : base.theme,
    playerOneName: asString(o.playerOneName, base.playerOneName),
    playerTwoName: asString(o.playerTwoName, base.playerTwoName),
    playerOneColor: asString(o.playerOneColor, base.playerOneColor, 32),
    playerTwoColor: asString(o.playerTwoColor, base.playerTwoColor, 32),
    playerOneAvatar: asString(o.playerOneAvatar, base.playerOneAvatar, 8),
    playerTwoAvatar: asString(o.playerTwoAvatar, base.playerTwoAvatar, 8),
    targetScore:
      o.targetScore === 5 || o.targetScore === 10 || o.targetScore === 15 || o.targetScore === 'free' || o.targetScore === 'custom'
        ? o.targetScore
        : base.targetScore,
    customTargetScore: asNumber(o.customTargetScore, base.customTargetScore, 3, 30),
    lastSelectedMode: MODES.has(String(o.lastSelectedMode))
      ? (o.lastSelectedMode as AppSettings['lastSelectedMode'])
      : base.lastSelectedMode,
    lastSelectedLevel: LEVELS.has(String(o.lastSelectedLevel))
      ? (o.lastSelectedLevel as AppSettings['lastSelectedLevel'])
      : base.lastSelectedLevel,
    lastGameFormat: (['quick', 'normal', 'full', 'rounds', 'fun'] as const).includes(
      o.lastGameFormat as AppSettings['lastGameFormat'],
    )
      ? (o.lastGameFormat as AppSettings['lastGameFormat'])
      : base.lastGameFormat,
    lastScoringMode: (['competitive', 'cooperative', 'none'] as const).includes(
      o.lastScoringMode as AppSettings['lastScoringMode'],
    )
      ? (o.lastScoringMode as AppSettings['lastScoringMode'])
      : base.lastScoringMode,
    advancedTasksEnabled: asBool(o.advancedTasksEnabled, base.advancedTasksEnabled),
    spinnerStyle: (['classic', 'glass', 'heart'] as const).includes(o.spinnerStyle as AppSettings['spinnerStyle'])
      ? (o.spinnerStyle as AppSettings['spinnerStyle'])
      : base.spinnerStyle,
    fontChoice: (['heebo', 'assistant', 'rubik'] as const).includes(o.fontChoice as AppSettings['fontChoice'])
      ? (o.fontChoice as AppSettings['fontChoice'])
      : base.fontChoice,
    animationStyle: o.animationStyle === 'reduced' ? 'reduced' : 'full',
    bgTheme: (['default', 'purple', 'rose', 'ocean'] as const).includes(o.bgTheme as AppSettings['bgTheme'])
      ? (o.bgTheme as AppSettings['bgTheme'])
      : base.bgTheme,
    colorblindMode: asBool(o.colorblindMode, base.colorblindMode),
    soundPack: (['default', 'soft', 'playful'] as const).includes(o.soundPack as AppSettings['soundPack'])
      ? (o.soundPack as AppSettings['soundPack'])
      : base.soundPack,
    roundCount: asNumber(o.roundCount, base.roundCount, 3, 40),
    coupleTaskMode: asBool(o.coupleTaskMode, base.coupleTaskMode),
    lastContentMode: CONTENT.has(String(o.lastContentMode))
      ? (o.lastContentMode as AppSettings['lastContentMode'])
      : base.lastContentMode,
    matureAgeConfirmed: asBool(o.matureAgeConfirmed, base.matureAgeConfirmed),
  };
}

function writeJson(key: string, value: unknown): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'storage_write_failed';
    console.warn('[storage]', msg);
    return { ok: false, error: msg };
  }
}

export function loadSettings(): AppSettings {
  try {
    return sanitizeSettings(safeParse(localStorage.getItem(SETTINGS_KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): { ok: boolean; error?: string } {
  return writeJson(SETTINGS_KEY, { ...sanitizeSettings(settings), _v: SCHEMA_VERSION });
}

export function loadHistory(): GameHistoryEntry[] {
  try {
    const parsed = safeParse(localStorage.getItem(HISTORY_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e === 'object')
      .slice(0, 20)
      .map((e) => {
        const o = e as Record<string, unknown>;
        return {
          id: asString(o.id, `${Date.now()}`, 64),
          date: asString(o.date, new Date().toISOString(), 40),
          eveningName: asString(o.eveningName, 'ערב זוגי'),
          mode: MODES.has(String(o.mode)) ? (o.mode as GameHistoryEntry['mode']) : 'mixed',
          completed: asNumber(o.completed, 0, 0, 9999),
          skipped: asNumber(o.skipped, 0, 0, 9999),
          winner: typeof o.winner === 'string' || o.winner === null ? (o.winner as string | null) : null,
          durationMinutes: asNumber(o.durationMinutes, 1, 1, 24 * 60),
        };
      });
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: GameHistoryEntry): { ok: boolean; error?: string } {
  const history = loadHistory().filter((h) => h.id !== entry.id).slice(0, 19);
  return writeJson(HISTORY_KEY, [entry, ...history]);
}

export function loadRecords(): LocalRecords {
  try {
    const parsed = safeParse(localStorage.getItem(RECORDS_KEY));
    if (!parsed || typeof parsed !== 'object') {
      return { mostCompleted: 0, longestStreak: 0, totalGames: 0, totalTasks: 0 };
    }
    const o = parsed as Record<string, unknown>;
    return {
      mostCompleted: asNumber(o.mostCompleted, 0, 0, 999999),
      longestStreak: asNumber(o.longestStreak, 0, 0, 999999),
      totalGames: asNumber(o.totalGames, 0, 0, 999999),
      totalTasks: asNumber(o.totalTasks, 0, 0, 999999),
    };
  } catch {
    return { mostCompleted: 0, longestStreak: 0, totalGames: 0, totalTasks: 0 };
  }
}

export function updateRecords(partial: Partial<LocalRecords>): LocalRecords {
  const current = loadRecords();
  const next = { ...current, ...partial };
  writeJson(RECORDS_KEY, next);
  return next;
}

export function loadUnlockedAchievements(): string[] {
  try {
    const parsed = safeParse(localStorage.getItem(ACHIEVEMENTS_KEY));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && x.length < 64))];
  } catch {
    return [];
  }
}

export function saveUnlockedAchievements(ids: string[]): { ok: boolean; error?: string } {
  const merged = [...new Set([...loadUnlockedAchievements(), ...ids])];
  return writeJson(ACHIEVEMENTS_KEY, merged);
}

export function clearAllLocalData(): { ok: boolean; error?: string } {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(ACHIEVEMENTS_KEY);
    localStorage.removeItem('couple-spin-custom-content');
    sessionStorage.removeItem('couple-spin-auth-session');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'clear_failed' };
  }
}
