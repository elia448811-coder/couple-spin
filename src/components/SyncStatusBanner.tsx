import { useEffect, useState } from 'react';
import type { CoupleRoom, RoomRole } from '../utils/coupleRoom';
import { partnerConnected } from '../utils/coupleRoom';
import { getSyncState, subscribeSyncState, type SyncState } from '../utils/cloudSync';
import { isFirebaseConfigured } from '../lib/firebase';

type SyncStatusBannerProps = {
  coupleRoom: CoupleRoom | null;
  coupleRole: RoomRole | null;
  partnerLive?: boolean;
};

function syncShortLabel(state: SyncState): string | null {
  if (state.status === 'syncing') return 'מסנכרן נתונים…';
  if (state.status === 'error') return `סנכרון נכשל: ${state.lastError ?? 'שגיאה'}`;
  return null;
}

export function SyncStatusBanner({ coupleRoom, coupleRole, partnerLive }: SyncStatusBannerProps) {
  const [syncState, setSyncState] = useState<SyncState>(getSyncState);

  useEffect(() => subscribeSyncState(setSyncState), []);

  const cloudHint = syncShortLabel(syncState);
  const roomHint =
    coupleRoom && coupleRole
      ? partnerLive
        ? 'מחוברים לחדר — צפייה בזמן אמת'
        : partnerConnected(coupleRoom)
          ? `חדר ${coupleRoom.displayCode} · מחוברים`
          : `חדר ${coupleRoom.displayCode} · ממתינים לשותף/ה`
      : null;

  const message = roomHint ?? cloudHint;
  if (!message) return null;
  if (!isFirebaseConfigured() && !coupleRoom) return null;

  const isError = syncState.status === 'error' && !roomHint;

  return (
    <div
      className={`sync-status-banner ${isError ? 'sync-status-banner--error' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
