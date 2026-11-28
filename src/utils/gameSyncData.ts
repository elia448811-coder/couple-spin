import type { GameState } from '../types/game';

/** Game state is JSON data; Firestore rejects absent optional values left as undefined. */
export function gameSyncData(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState;
}
