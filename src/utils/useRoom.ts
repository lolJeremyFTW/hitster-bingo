import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from './supabaseClient';

/**
 * Gedeelde kamer via Supabase.
 *
 * De host maakt een kamer aan, spelers scannen de QR-code of typen de code en
 * kiezen een naam. Die naam belandt in de spelerstabel en daarmee vult het
 * scorebord zichzelf — niemand hoeft handmatig namen in te voeren.
 *
 * De volledige spelstaat staat als JSON in één kolom. Eén rij bijwerken is
 * genoeg om alle telefoons gelijk te trekken, en realtime duwt die wijziging
 * meteen door.
 */

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
}

export type RoomStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  /** Supabase bereikbaar, maar de migratie is nog niet gedraaid */
  | 'not-migrated'
  | 'offline';

interface UseRoomResult {
  status: RoomStatus;
  error: string | null;
  roomCode: string | null;
  players: RoomPlayer[];
  /** Id van deze telefoon binnen de kamer */
  myPlayerId: string | null;
  isHost: boolean;
  sharedState: Record<string, unknown> | null;
  createRoom: (code: string, mode: string, hostName: string) => Promise<boolean>;
  /** Geeft de modus van de kamer terug, zodat de joiner hetzelfde spel krijgt */
  joinRoom: (code: string, name: string) => Promise<string | null>;
  updateSharedState: (state: unknown) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

const PLAYER_ID_KEY = 'hitster_room_player_id';

export function useRoom(): UseRoomResult {
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  // Bewust niet uit sessionStorage voorladen: die id hoort bij een kamer uit
  // een eerdere sessie, die allang opgeruimd kan zijn. Een herladen speler
  // hoort gewoon opnieuw te joinen.
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [sharedState, setSharedState] = useState<Record<string, unknown> | null>(null);

  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null>(null);
  /** Voorkomt dat dezelfde telefoon zichzelf twee keer in de kamer zet */
  const joinGuard = useRef(false);

  /** Zet een leesbare melding neer in plaats van een rauwe Postgres-fout. */
  const describe = (err: { code?: string; message: string }): string => {
    // Mislukt is niet binnen: grendel los, zodat opnieuw proberen kan
    joinGuard.current = false;
    if (err.code === '42P01' || /does not exist/i.test(err.message)) {
      setStatus('not-migrated');
      return 'De tabellen bestaan nog niet. Draai supabase/migrations/001_hitster.sql in de SQL Editor.';
    }
    if (/Invalid schema|not exposed|schemas are exposed/i.test(err.message)) {
      setStatus('not-migrated');
      return 'Het schema "hitster" staat nog niet bij Exposed schemas in Supabase → Settings → API.';
    }
    setStatus('offline');
    return err.message;
  };

  const refreshPlayers = useCallback(async (code: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const { data, error: err } = await sb
      .from('players')
      .select('id,name,is_host,joined_at')
      .eq('room_code', code)
      .order('joined_at', { ascending: true });

    if (err) { setError(describe(err)); return; }

    setPlayers((data ?? []).map(p => ({
      id: p.id as string,
      name: p.name as string,
      isHost: !!p.is_host,
      joinedAt: p.joined_at as string,
    })));
  }, []);

  /** Realtime: nieuwe spelers en spelstaat-wijzigingen binnentrekken. */
  const subscribe = useCallback((code: string) => {
    const sb = getSupabase();
    if (!sb) return;

    channelRef.current?.unsubscribe();

    const channel = sb
      .channel(`room:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'hitster', table: 'players', filter: `room_code=eq.${code}` },
        () => { refreshPlayers(code); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'hitster', table: 'rooms', filter: `code=eq.${code}` },
        (payload: { new?: { state?: Record<string, unknown> } }) => {
          if (payload.new?.state) setSharedState(payload.new.state);
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [refreshPlayers]);

  const createRoom = useCallback(async (code: string, mode: string, hostName: string) => {
    const sb = getSupabase();
    if (!sb) { setStatus('offline'); setError('Supabase is niet geconfigureerd.'); return false; }

    // React mount effects twee keer in StrictMode, en een hermount roept dit
    // opnieuw aan. Zonder deze grendel belandt de host twee keer in de lijst.
    if (joinGuard.current) return false;
    joinGuard.current = true;

    setStatus('connecting');
    setError(null);

    const { error: roomErr } = await sb
      .from('rooms')
      .upsert({ code, mode, state: {}, is_open: true }, { onConflict: 'code' });

    if (roomErr) { setError(describe(roomErr)); return false; }

    const { data: player, error: playerErr } = await sb
      .from('players')
      .insert({ room_code: code, name: hostName, is_host: true })
      .select('id')
      .single();

    if (playerErr) { setError(describe(playerErr)); return false; }

    const pid = player.id as string;
    sessionStorage.setItem(PLAYER_ID_KEY, pid);
    setMyPlayerId(pid);
    setIsHost(true);
    setRoomCode(code);
    setStatus('connected');

    await refreshPlayers(code);
    subscribe(code);
    return true;
  }, [refreshPlayers, subscribe]);

  const joinRoom = useCallback(async (code: string, name: string) => {
    const sb = getSupabase();
    if (!sb) { setStatus('offline'); setError('Supabase is niet geconfigureerd.'); return null; }

    if (joinGuard.current) return null;
    joinGuard.current = true;

    setStatus('connecting');
    setError(null);

    // mode meelezen: de kamer bepaalt welk spel er gespeeld wordt, niet wat
    // deze telefoon toevallig in de lobby had aangeklikt
    const { data: room, error: roomErr } = await sb
      .from('rooms')
      .select('code,mode,state,is_open')
      .eq('code', code)
      .maybeSingle();

    if (roomErr) { setError(describe(roomErr)); return null; }
    if (!room) {
      joinGuard.current = false;
      setStatus('offline');
      setError(`Kamer ${code} bestaat niet. Laat de host het spel eerst starten.`);
      return null;
    }

    const { data: player, error: playerErr } = await sb
      .from('players')
      .insert({ room_code: code, name, is_host: false })
      .select('id')
      .single();

    if (playerErr) { setError(describe(playerErr)); return null; }

    const pid = player.id as string;
    sessionStorage.setItem(PLAYER_ID_KEY, pid);
    setMyPlayerId(pid);
    setIsHost(false);
    setRoomCode(code);
    setSharedState((room.state as Record<string, unknown>) ?? null);
    setStatus('connected');

    await refreshPlayers(code);
    subscribe(code);
    return (room.mode as string) ?? null;
  }, [refreshPlayers, subscribe]);

  const updateSharedState = useCallback(async (state: unknown) => {
    const sb = getSupabase();
    if (!sb || !roomCode) return;
    const { error: err } = await sb
      .from('rooms')
      .update({ state: state as Record<string, unknown> })
      .eq('code', roomCode);
    if (err) setError(describe(err));
  }, [roomCode]);

  const leaveRoom = useCallback(async () => {
    const sb = getSupabase();
    channelRef.current?.unsubscribe();
    channelRef.current = null;

    if (sb && myPlayerId) {
      await sb.from('players').delete().eq('id', myPlayerId);
    }
    joinGuard.current = false;
    sessionStorage.removeItem(PLAYER_ID_KEY);
    setMyPlayerId(null);
    setRoomCode(null);
    setPlayers([]);
    setSharedState(null);
    setIsHost(false);
    setStatus('idle');
  }, [myPlayerId]);

  // Kanaal netjes sluiten als het scherm verdwijnt
  useEffect(() => () => { channelRef.current?.unsubscribe(); }, []);

  return {
    status, error, roomCode, players, myPlayerId, isHost,
    sharedState, createRoom, joinRoom, updateSharedState, leaveRoom,
  };
}
