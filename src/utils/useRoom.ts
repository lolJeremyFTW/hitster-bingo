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
  /** Bingo-voortgang per speler-id, live van de andere telefoons */
  liveScores: Record<string, { marked: number; bingos: number }>;
  /** Eigen voortgang rondsturen; niet opgeslagen, alleen voor deze partij */
  broadcastScore: (marked: number, bingos: number) => void;
  createRoom: (code: string, mode: string, hostName: string) => Promise<boolean>;
  /** Geeft de modus van de kamer terug, zodat de joiner hetzelfde spel krijgt */
  joinRoom: (code: string, name: string) => Promise<string | null>;
  updateSharedState: (state: unknown) => Promise<void>;
  leaveRoom: () => Promise<void>;
  /**
   * Gezet wanneer een herladen telefoon automatisch terug de kamer in is
   * gestapt; vertelt de app welk spel er weer geopend moet worden.
   */
  restoredMode: string | null;
}

/** Kamercode + speler-id van deze tab, zodat een refresh je niet verdubbelt */
const SESSION_KEY = 'hitster_room_session';

function saveSession(code: string, playerId: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId }));
}

export function useRoom(): UseRoomResult {
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  // Niet zomaar uit sessionStorage voorladen: eerst checkt restoreSession bij
  // de database of kamer én spelersrij nog bestaan. Pas dan stap je terug in.
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [restoredMode, setRestoredMode] = useState<string | null>(null);
  const [sharedState, setSharedState] = useState<Record<string, unknown> | null>(null);
  const [liveScores, setLiveScores] = useState<Record<string, { marked: number; bingos: number }>>({});

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
      // Het id als scheidsrechter bij gelijke joined_at: zonder die tweede
      // sortering geeft Postgres per toestel een andere volgorde terug, en dan
      // wijst dezelfde activePlayerIndex overal naar een andere speler
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true });

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
      // Bingo-scores gaan via broadcast in plaats van de database: ze gelden
      // alleen deze partij, en zo kan niemand elkaars score overschrijven —
      // iedereen stuurt uitsluitend zijn eigen cijfers rond.
      .on('broadcast', { event: 'score' }, ({ payload }: { payload: { playerId: string; marked: number; bingos: number } }) => {
        if (!payload?.playerId) return;
        setLiveScores(prev => ({
          ...prev,
          [payload.playerId]: { marked: payload.marked, bingos: payload.bingos },
        }));
      })
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
    saveSession(code, pid);
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

    // Zelfde naam als een bestaande speler in deze kamer? Dan ben jij dat —
    // een telefoon die herlaadde of de browser opnieuw opende. Neem die rij
    // over in plaats van een tweede "Jorn" naast de eerste te zetten.
    const { data: existingPlayers, error: listErr } = await sb
      .from('players')
      .select('id,name,is_host,joined_at')
      .eq('room_code', code)
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true });

    if (listErr) { setError(describe(listErr)); return null; }

    const wanted = name.trim().toLowerCase();
    const matches = (existingPlayers ?? []).filter(
      p => (p.name as string).trim().toLowerCase() === wanted
    );

    let pid: string;
    let amHost = false;

    if (matches.length > 0) {
      // De oudste rij is het origineel — daar hangt de tijdlijn aan
      pid = matches[0].id as string;
      amHost = !!matches[0].is_host;

      // Spoken van eerdere refreshes meteen opruimen
      const ghosts = matches.slice(1).map(p => p.id as string);
      if (ghosts.length > 0) {
        await sb.from('players').delete().in('id', ghosts);
      }
    } else {
      const { data: player, error: playerErr } = await sb
        .from('players')
        .insert({ room_code: code, name, is_host: false })
        .select('id')
        .single();

      if (playerErr) { setError(describe(playerErr)); return null; }
      pid = player.id as string;
    }

    saveSession(code, pid);
    setMyPlayerId(pid);
    setIsHost(amHost);
    setRoomCode(code);
    setSharedState((room.state as Record<string, unknown>) ?? null);
    setStatus('connected');

    await refreshPlayers(code);
    subscribe(code);
    return (room.mode as string) ?? null;
  }, [refreshPlayers, subscribe]);

  /**
   * Een herladen tab stapt automatisch terug in zijn kamer, als dezelfde
   * speler. Eerst verifiëren bij de database dat kamer en spelersrij nog
   * bestaan — een opgeruimde kamer is echt voorbij, dan gewoon naar de lobby.
   */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || joinGuard.current) return;

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    let saved: { code?: string; playerId?: string };
    try {
      saved = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    if (!saved.code || !saved.playerId) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    void (async () => {
      const { data: room } = await sb
        .from('rooms')
        .select('code,mode,state')
        .eq('code', saved.code!)
        .maybeSingle();
      if (!room) { sessionStorage.removeItem(SESSION_KEY); return; }

      const { data: me } = await sb
        .from('players')
        .select('id,is_host')
        .eq('id', saved.playerId!)
        .maybeSingle();
      if (!me) { sessionStorage.removeItem(SESSION_KEY); return; }

      joinGuard.current = true;
      setMyPlayerId(me.id as string);
      setIsHost(!!me.is_host);
      setRoomCode(saved.code!);
      setSharedState((room.state as Record<string, unknown>) ?? null);
      setStatus('connected');
      setRestoredMode((room.mode as string) ?? null);

      await refreshPlayers(saved.code!);
      subscribe(saved.code!);
    })();
  }, [refreshPlayers, subscribe]);

  const broadcastScore = useCallback((marked: number, bingos: number) => {
    if (!channelRef.current || !myPlayerId) return;
    // Ook lokaal bijhouden: je eigen broadcast komt niet bij jezelf terug
    setLiveScores(prev => ({ ...prev, [myPlayerId]: { marked, bingos } }));
    channelRef.current.send({
      type: 'broadcast',
      event: 'score',
      payload: { playerId: myPlayerId, marked, bingos },
    });
  }, [myPlayerId]);

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
    sessionStorage.removeItem(SESSION_KEY);
    setRestoredMode(null);
    setMyPlayerId(null);
    setRoomCode(null);
    setPlayers([]);
    setSharedState(null);
    setLiveScores({});
    setIsHost(false);
    setStatus('idle');
  }, [myPlayerId]);

  // Kanaal netjes sluiten als het scherm verdwijnt
  useEffect(() => () => { channelRef.current?.unsubscribe(); }, []);

  return {
    status, error, roomCode, players, myPlayerId, isHost,
    sharedState, liveScores, broadcastScore,
    createRoom, joinRoom, updateSharedState, leaveRoom,
    restoredMode,
  };
}
