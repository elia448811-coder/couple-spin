// Shared by the room API and the browser before accepting serialized game state.
const oneOf = (...choices) => value => choices.includes(value);
const text = max => value => typeof value === 'string' && value.length <= max;
const integer = max => value => Number.isSafeInteger(value) && value >= 0 && value <= max;
const optional = check => value => value === undefined || check(value);
const nullable = check => value => value === null || check(value);
const list = (max, check) => value => Array.isArray(value) && value.length <= max && value.every(check);
const boolean = value => typeof value === 'boolean';
const count = integer(Number.MAX_SAFE_INTEGER);
const timestamp = integer(8640000000000000);
const id = text(256);
const labelKey = value => id(value) && value.length > 0 && !Object.hasOwn(Object.prototype, value);
const level = oneOf('easy', 'normal', 'advanced');

function record(fields) {
  const entries = Object.entries(fields);
  return value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => Object.hasOwn(fields, key))
    && entries.every(([key, check]) => check(Object.hasOwn(value, key) ? value[key] : undefined));
}

const card = record({
  id, title: text(1024), description: text(4096), category: labelKey, level,
  durationSeconds: optional(integer(86400)), isCoupleTask: optional(boolean),
  kind: optional(oneOf('task', 'question')), questionGroup: optional(labelKey),
});

const stats = record({
  totalCompleted: count, totalSkipped: count, streak: count, maxStreak: count,
  funniestTaskId: nullable(id), funniestTaskTitle: nullable(text(1024)),
  startTime: timestamp, roundNumber: count, tasksPresented: optional(count),
});

export const isValidRemoteGameState = record({
  screen: oneOf('welcome', 'tutorial', 'setup', 'dice-roll', 'game', 'end', 'settings'),
  mode: oneOf('funny', 'romantic', 'challenge', 'calm', 'mixed', 'spicy'),
  level, gameFormat: oneOf('quick', 'normal', 'full', 'rounds', 'fun'),
  scoringMode: oneOf('competitive', 'cooperative', 'none'), coupleTaskMode: boolean,
  contentMode: oneOf('tasks', 'questions', 'mixed'), eveningName: text(512),
  playerOneName: text(256), playerTwoName: text(256), currentPlayerIndex: oneOf(0, 1),
  scores: value => Array.isArray(value) && value.length === 2 && count(value[0]) && count(value[1]),
  cooperativeScore: count, usedTaskIds: list(10000, id), favoriteTaskIds: optional(list(10000, id)),
  currentTask: nullable(card), isSpinning: boolean, wheelLanded: boolean,
  targetScore: oneOf(5, 10, 15, 'free', 'custom'), customTargetScore: count, roundTarget: count,
  timeLimitSeconds: nullable(count), timeRemainingSeconds: nullable(count),
  timeDeadlineMs: nullable(timestamp), finishEventId: nullable(id), stats,
  winner: oneOf(0, 1, 'tie', null), spinCategory: nullable(labelKey),
  unlockedAchievements: list(512, id), sessionNewAchievements: list(512, id),
  paused: optional(boolean), uiBlocked: optional(boolean), poolEmpty: optional(boolean),
  lastAction: optional(oneOf('complete', 'skip', 'replace', null)),
});
