import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasCompletedOnboarding, markOnboardingComplete, resetOnboarding } from './onboarding';

describe('onboarding', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
    });
    resetOnboarding();
  });

  it('starts incomplete', () => {
    expect(hasCompletedOnboarding()).toBe(false);
  });

  it('marks complete after tutorial', () => {
    markOnboardingComplete();
    expect(hasCompletedOnboarding()).toBe(true);
  });
});
