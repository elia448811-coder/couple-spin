import { describe, expect, it } from 'vitest';
import { isFirebaseConfigured } from './firebase';

describe('firebase config', () => {
  it('reports configured when env vars are present', () => {
    expect(isFirebaseConfigured()).toBe(Boolean(import.meta.env.VITE_FIREBASE_API_KEY));
  });
});
