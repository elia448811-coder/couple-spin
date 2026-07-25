/**
 * Feature flags — toggle without redeploy (defaults here; override via localStorage).
 */
export type FeatureFlags = {
  enablePartnerControl: boolean;
  enableRoomChat: boolean;
  enableSurpriseMode: boolean;
  enablePushNotifications: boolean;
  enableMonitoring: boolean;
};

const STORAGE_KEY = 'couple-spin-feature-flags';

const DEFAULTS: FeatureFlags = {
  enablePartnerControl: false,
  enableRoomChat: false,
  enableSurpriseMode: true,
  enablePushNotifications: false,
  enableMonitoring: true,
};

export function getFeatureFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  const next = { ...getFeatureFlags(), [key]: value };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return Boolean(getFeatureFlags()[key]);
}
