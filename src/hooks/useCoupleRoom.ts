import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import { isFirebaseConfigured } from '../lib/firebase';
import { isFeatureEnabled } from '../utils/featureFlags';
import {
  appendRoomEvent,
  bothPlayersReady,
  createCoupleRoom,
  extractGameFromEvent,
  getStoredRoom,
  HEARTBEAT_INTERVAL_MS,
  joinCoupleRoom,
  leaveCoupleRoom,
  partnerConnected,
  playersFromRoom,
  pushRoomGameState,
  sendPresenceHeartbeat,
  setPlayerReady,
  subscribeCoupleRoom,
  subscribeRoomEvents,
  type CoupleRoom,
  type RoomRole,
} from '../utils/coupleRoom';

export function useCoupleRoom() {
  const stored = getStoredRoom();
  const [room, setRoom] = useState<CoupleRoom | null>(null);
  const [role, setRole] = useState<RoomRole | null>(() => stored?.role ?? null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => stored?.roomId ?? null);
  const [activeDisplayCode, setActiveDisplayCode] = useState<string | null>(
    () => stored?.displayCode ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEventVersion, setLastEventVersion] = useState(0);
  const remoteGameRef = useRef<GameState | null>(null);
  const eventVersionRef = useRef(0);

  const players = useMemo(() => (room ? playersFromRoom(room) : []), [room]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !activeRoomId || !activeDisplayCode) return;

    const unsubRoom = subscribeCoupleRoom(activeRoomId, activeDisplayCode, (next) => {
      setRoom(next);
      if (!next) {
        setRole(null);
        setActiveRoomId(null);
        setActiveDisplayCode(null);
      }
      if (next) setLastEventVersion(next.version);
    });
    const unsubEvents = subscribeRoomEvents(activeRoomId, eventVersionRef.current, (event) => {
      if (event.version <= eventVersionRef.current) return;
      eventVersionRef.current = event.version;
      setLastEventVersion(event.version);
      const game = extractGameFromEvent(event);
      if (game) remoteGameRef.current = game;
    });

    return () => {
      unsubRoom();
      unsubEvents();
    };
  }, [activeRoomId, activeDisplayCode]);

  useEffect(() => {
    if (!room?.roomId) return;
    const tick = () => void sendPresenceHeartbeat(room.roomId);
    tick();
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [room?.roomId]);

  const createRoom = useCallback(async (hostName: string, eveningTitle?: string) => {
    setBusy(true);
    setError(null);
    const result = await createCoupleRoom(hostName, eveningTitle);
    setBusy(false);
    if (!result.ok || !result.room) {
      setError(result.error ?? 'create_failed');
      return null;
    }
    eventVersionRef.current = 0;
    remoteGameRef.current = null;
    setRoom(result.room);
    setRole('host');
    setActiveRoomId(result.room.roomId);
    setActiveDisplayCode(result.room.displayCode);
    return result.room;
  }, []);

  const joinRoom = useCallback(async (code: string, partnerName: string) => {
    setBusy(true);
    setError(null);
    const result = await joinCoupleRoom(code, partnerName);
    setBusy(false);
    if (!result.ok || !result.room) {
      setError(result.error ?? 'join_failed');
      return null;
    }
    const storedAfter = getStoredRoom();
    eventVersionRef.current = 0;
    remoteGameRef.current = null;
    setRoom(result.room);
    setRole(storedAfter?.role ?? 'partner');
    setActiveRoomId(result.room.roomId);
    setActiveDisplayCode(result.room.displayCode || code.replace(/\D/g, '').slice(0, 8));
    return result.room;
  }, []);

  const leaveRoom = useCallback(async () => {
    setBusy(true);
    await leaveCoupleRoom();
    setRoom(null);
    setRole(null);
    setActiveRoomId(null);
    setActiveDisplayCode(null);
    eventVersionRef.current = 0;
    remoteGameRef.current = null;
    setBusy(false);
  }, []);

  const toggleReady = useCallback(
    async (ready: boolean) => {
      if (!room?.roomId) return;
      await setPlayerReady(room.roomId, ready);
    },
    [room?.roomId],
  );

  const syncGameToRoom = useCallback(
    async (game: GameState) => {
      if (!room?.roomId) return;
      const canSync = role === 'host' || (role === 'partner' && isFeatureEnabled('enablePartnerControl'));
      if (!canSync) return;
      // Rules allow only host to write GAME_* events; partner control stays client-gated.
      if (role !== 'host') return;
      await pushRoomGameState(room.roomId, game);
    },
    [room?.roomId, role],
  );

  const signalGameStarted = useCallback(async () => {
    if (!room?.roomId || role !== 'host') return;
    await appendRoomEvent(room.roomId, 'GAME_STARTED', {});
  }, [room?.roomId, role]);

  const consumeRemoteGame = useCallback((): GameState | null => {
    const game = remoteGameRef.current;
    remoteGameRef.current = null;
    return game;
  }, []);

  const peekRemoteGame = useCallback((): GameState | null => remoteGameRef.current, []);

  return {
    room,
    players,
    role,
    busy,
    error,
    connected: partnerConnected(room),
    allReady: bothPlayersReady(room),
    available: isFirebaseConfigured(),
    lastEventVersion,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    syncGameToRoom,
    signalGameStarted,
    consumeRemoteGame,
    peekRemoteGame,
    gameVersion: room?.version ?? 0,
  };
}
