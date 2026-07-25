import type { GameState } from '../types/game';

const UNDO_KEY = 'couple-spin-undo';
let undoState: GameState | null = null;

export function pushUndo(state: GameState): void {
  undoState = state;
  try {
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(state));
  } catch {}
}

export function popUndo(): GameState | null {
  const state = undoState ?? readStoredUndo();
  undoState = null;
  try {
    sessionStorage.removeItem(UNDO_KEY);
  } catch {}
  return state;
}

export function hasUndo(): boolean {
  if (undoState) return true;
  try {
    return sessionStorage.getItem(UNDO_KEY) !== null;
  } catch {
    return false;
  }
}

function readStoredUndo(): GameState | null {
  try {
    const raw = sessionStorage.getItem(UNDO_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' ? (value as GameState) : null;
  } catch {
    return null;
  }
}
