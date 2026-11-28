import { isValidRemoteGameState } from './game-state-schema.mjs';

export const MAX_PAYLOAD_BYTES = 120_000;

export function exactKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.includes(key));
}

export function isValidRoomEventPayload(type, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  switch (type) {
    case 'PLAYER_READY': return exactKeys(p, ['ready']) && (p.ready === undefined || typeof p.ready === 'boolean');
    case 'GAME_STARTED': return exactKeys(p, []);
    case 'TURN_CHANGED': return exactKeys(p, ['currentPlayerIndex']) && (p.currentPlayerIndex === 0 || p.currentPlayerIndex === 1);
    case 'GAME_ENDED':
    case 'GAME_SNAPSHOT': return exactKeys(p, ['gameState', 'screen', 'sparkStreak'])
      && isValidRemoteGameState(p.gameState) && p.screen === p.gameState.screen
      && (type === 'GAME_ENDED'
        ? p.screen === 'end' && !!p.gameState.finishEventId && p.gameState.winner !== null && p.gameState.currentTask === null
        : ['tutorial', 'setup', 'dice-roll', 'game'].includes(p.screen))
      && Number.isSafeInteger(p.sparkStreak) && p.sparkStreak === p.gameState.stats.streak;
    default: return false;
  }
}
