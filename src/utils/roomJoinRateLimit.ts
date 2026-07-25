const STORAGE_KEY = 'couple-spin-join-attempts';
export const MAX_JOIN_ATTEMPTS = 8;
export const JOIN_LOCKOUT_MS = 60_000;

type JoinAttemptState = {
  attempts: number;
  lockedUntilMs: number;
};

function readState(): JoinAttemptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntilMs: 0 };
    const parsed = JSON.parse(raw) as Partial<JoinAttemptState>;
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntilMs: Number(parsed.lockedUntilMs) || 0,
    };
  } catch {
    return { attempts: 0, lockedUntilMs: 0 };
  }
}

function writeState(state: JoinAttemptState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function checkJoinRateLimit(): { allowed: boolean; retryAfterMs: number } {
  const state = readState();
  const now = Date.now();
  if (state.lockedUntilMs > now) {
    return { allowed: false, retryAfterMs: state.lockedUntilMs - now };
  }
  if (state.lockedUntilMs > 0 && state.lockedUntilMs <= now) {
    writeState({ attempts: 0, lockedUntilMs: 0 });
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function recordJoinFailure(): void {
  const state = readState();
  const attempts = state.attempts + 1;
  if (attempts >= MAX_JOIN_ATTEMPTS) {
    writeState({ attempts: 0, lockedUntilMs: Date.now() + JOIN_LOCKOUT_MS });
    return;
  }
  writeState({ ...state, attempts });
}

export function resetJoinRateLimit(): void {
  writeState({ attempts: 0, lockedUntilMs: 0 });
}
