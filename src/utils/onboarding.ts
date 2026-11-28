import { accountLocal } from './accountStorage';
const ONBOARDING_KEY = 'couple-spin-onboarding-done';

export function hasCompletedOnboarding(): boolean {
  try {
    return accountLocal.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboardingComplete(): void {
  try {
    accountLocal.setItem(ONBOARDING_KEY, '1');
  } catch {
    /* ignore quota errors */
  }
}

export function resetOnboarding(): void {
  try {
    accountLocal.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}
