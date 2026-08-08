import { useMemo, useState } from 'react';
import type { CoupleRoom, RoomPlayer, RoomRole } from '../utils/coupleRoom';
import { isPlayerOnline, presenceLabel } from '../utils/coupleRoom';
import { getRoomError } from '../utils/roomErrors';
import { buildInviteUrl, shareRoomInvite } from '../utils/roomInvite';

type PartnerConnectPanelProps = {
  available: boolean;
  room: CoupleRoom | null;
  players: RoomPlayer[];
  role: RoomRole | null;
  connected: boolean;
  allReady: boolean;
  busy: boolean;
  error: string | null;
  defaultHostName: string;
  defaultPartnerName: string;
  onCreate: (hostName: string) => void;
  onJoin: (code: string, partnerName: string) => void;
  onLeave: () => void;
  onToggleReady: (ready: boolean) => void;
  initialJoinCode?: string | null;
};

export function PartnerConnectPanel({
  available,
  room,
  players,
  role,
  connected,
  allReady,
  busy,
  error,
  defaultHostName,
  defaultPartnerName,
  onCreate,
  onJoin,
  onLeave,
  onToggleReady,
  initialJoinCode,
}: PartnerConnectPanelProps) {
  const [mode, setMode] = useState<'idle' | 'join'>(initialJoinCode ? 'join' : 'idle');
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '');
  const [partnerName, setPartnerName] = useState(defaultPartnerName);
  const [copied, setCopied] = useState(false);

  const errorInfo = getRoomError(error);
  const selfUid = role === 'host' ? room?.hostUid : room?.partnerUid;
  const selfPlayer = players.find((p) => p.uid === selfUid);
  const selfReady = Boolean(selfPlayer?.ready);

  const playerRows = useMemo(() => {
    if (!room) return [];
    const rows: { key: string; name: string; subtitle: string; online: boolean }[] = [];
    const host = players.find((p) => p.uid === room.hostUid);
    const partner = players.find((p) => p.uid === room.partnerUid);
    rows.push({
      key: 'host',
      name: room.hostName,
      subtitle: host ? presenceLabel(host) : 'מחובר/ת',
      online: host ? isPlayerOnline(host) : true,
    });
    if (room.partnerUid) {
      rows.push({
        key: 'partner',
        name: room.partnerName ?? 'שותף/ה',
        subtitle: partner ? presenceLabel(partner) : 'ממתין/ה',
        online: partner ? isPlayerOnline(partner) : false,
      });
    }
    return rows;
  }, [players, room]);

  if (!available) {
    return (
      <div className="hub-card hub-card--muted">
        <p className="hub-card__kicker">חיבור זוגי</p>
        <p className="hub-card__text">הענן לא מוגדר בסביבה הזו. משחק מקומי עדיין זמין.</p>
      </div>
    );
  }

  if (room) {
    const expiresInMin = Math.max(0, Math.round((room.expiresAtMs - Date.now()) / 60000));

    return (
      <div className="hub-card hub-card--live">
        <div className="hub-card__header">
          <p className="hub-card__kicker">חדר זוגי פעיל</p>
          <span className={`hub-pill ${connected ? 'hub-pill--live' : 'hub-pill--wait'}`}>
            {connected ? (allReady ? '● מוכנים' : '● מחוברים') : '○ ממתינים'}
          </span>
        </div>
        <div className="hub-room-code" aria-label={`קוד חדר ${room.displayCode}`}>
          <span className="hub-room-code__label">קוד חדר · תקף עוד {expiresInMin} דק׳</span>
          <strong className="hub-room-code__value">{room.displayCode}</strong>
        </div>
        <p className="hub-card__text">
          {role === 'host' ? 'שתפו את הקישור או הקוד עם השותף/ה' : `מחובר/ת ל-${room.hostName}`}
        </p>

        <div className="hub-partners">
          {playerRows.map((row) => (
            <div key={row.key} className="hub-partner">
              <span>{row.online ? '💜' : '⏳'}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.subtitle}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="hub-actions-row">
          <button
            type="button"
            className={`hub-btn pressable ${selfReady ? 'hub-btn--secondary' : 'hub-btn--primary'}`}
            onClick={() => onToggleReady(!selfReady)}
            disabled={busy}
          >
            {selfReady ? 'ביטול מוכנות' : 'אני מוכן/ה'}
          </button>
          {role === 'host' && (
            <>
              <button
                type="button"
                className="hub-btn hub-btn--secondary pressable"
                onClick={async () => {
                  await shareRoomInvite(room.displayCode, room.hostName);
                }}
                disabled={busy}
              >
                שתף ב-WhatsApp
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--ghost pressable"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildInviteUrl(room.displayCode));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                disabled={busy}
              >
                {copied ? 'הועתק!' : 'העתק קישור'}
              </button>
            </>
          )}
        </div>

        {connected && !allReady && (
          <p className="hub-card__text hub-card__text--hint">שני השחקנים צריכים לסמן מוכנות לפני שמתחילים.</p>
        )}

        <button type="button" className="hub-btn hub-btn--ghost pressable" onClick={onLeave} disabled={busy}>
          ניתוק מהחדר
        </button>
      </div>
    );
  }

  return (
    <div className="hub-card">
      <p className="hub-card__kicker">חדר זוגי</p>
      <h2 className="hub-card__title">משחקים יחד, כל אחד מהטלפון שלו</h2>
      <p className="hub-card__text">
        יוצרים חדר, שולחים קוד לבן או בת הזוג — ונכנסים לאותו ערב בזמן אמת.
      </p>

      {errorInfo && (
        <div className="hub-error" role="alert">
          <strong>{errorInfo.title}</strong>
          <p>{errorInfo.message}</p>
          {errorInfo.retryable && <small>אפשר לנסות שוב בעוד רגע.</small>}
        </div>
      )}

      {mode === 'idle' && (
        <div className="hub-actions-row">
          <button
            type="button"
            className="hub-btn hub-btn--primary pressable"
            onClick={() => onCreate(defaultHostName)}
            disabled={busy}
          >
            אני יוצר/ת חדר
          </button>
          <button
            type="button"
            className="hub-btn hub-btn--secondary pressable"
            onClick={() => setMode('join')}
            disabled={busy}
          >
            יש לי קוד
          </button>
        </div>
      )}

      {mode === 'join' && (
        <form
          className="hub-join-form"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(joinCode, partnerName);
          }}
        >
          <label className="hub-field">
            <span>קוד חדר</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="12345678"
              autoComplete="one-time-code"
            />
          </label>
          <label className="hub-field">
            <span>השם שלך</span>
            <input
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="שחקן 2"
              maxLength={32}
            />
          </label>
          <div className="hub-actions-row">
            <button type="submit" className="hub-btn hub-btn--primary pressable" disabled={busy || joinCode.length !== 8}>
              הצטרף
            </button>
            <button type="button" className="hub-btn hub-btn--ghost pressable" onClick={() => setMode('idle')}>
              ביטול
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
