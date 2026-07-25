import { isFeatureEnabled } from './featureFlags';

export type MonitorContext = Record<string, string | number | boolean | null | undefined>;

export function captureError(error: unknown, context?: MonitorContext): void {
  if (!isFeatureEnabled('enableMonitoring')) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error('[monitor]', { message, context, at: new Date().toISOString() });
}

export function captureEvent(name: string, context?: MonitorContext): void {
  if (!isFeatureEnabled('enableMonitoring')) return;
  console.info('[event]', name, context ?? {});
}
