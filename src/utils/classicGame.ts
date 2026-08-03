import type { CustomTrack } from '../types/hitster';

/**
 * Spelregels van het klassieke Hitster, als pure functies.
 *
 * Bewust vrij van React en van de netwerklaag: dezelfde functies draaien
 * straks zowel lokaal als op de gedeelde spelstaat in Supabase, en zijn zo
 * los te testen.
 *
 * Beurt: nummer speelt → actieve speler plaatst de kaart blind in zijn
 * tijdlijn → tegenstanders mogen HITSTER roepen en een munt op een positie
 * zetten → kaart wordt omgedraaid en alles wordt afgerekend.
 */

export const MAX_TOKENS = 5;
export const CARDS_TO_WIN = 10;
/** 3 munten inruilen plaatst de bovenste kaart gratis goed */
export const TOKENS_FOR_FREE_CARD = 3;

export interface TimelineCard {
  trackId: string;
  title: string;
  artist: string;
  year: number;
}

export interface ClassicPlayer {
  id: string;
  name: string;
  timeline: TimelineCard[];
  tokens: number;
  isHost?: boolean;
}

/** Een claim van een tegenstander die HITSTER riep */
export interface StealClaim {
  playerId: string;
  /** Positie in de tijdlijn van de actieve speler (0 = helemaal links) */
  position: number;
}

export type TurnPhase =
  /** Nummer speelt, actieve speler denkt na */
  | 'listening'
  /** Actieve speler heeft geplaatst; anderen mogen stelen */
  | 'placed'
  /** Kaart omgedraaid, uitslag zichtbaar */
  | 'revealed';

export interface ClassicGameState {
  players: ClassicPlayer[];
  activePlayerIndex: number;
  phase: TurnPhase;
  /** Het nummer van deze beurt; year blijft verborgen tot de reveal */
  currentTrack: CustomTrack | null;
  /** Waar de actieve speler de kaart neerlegde */
  placedPosition: number | null;
  /** Claimt de titel+artiest-bonus */
  claimedTitleArtist: boolean;
  steals: StealClaim[];
  /** Tracks die al gespeeld zijn, zodat niemand hetzelfde nummer twee keer krijgt */
  usedTrackIds: string[];
  winnerId: string | null;
  roundNumber: number;
}

export function createPlayer(id: string, name: string, isHost = false): ClassicPlayer {
  return { id, name, timeline: [], tokens: 0, isHost };
}

export function createInitialState(players: ClassicPlayer[]): ClassicGameState {
  return {
    players,
    activePlayerIndex: 0,
    phase: 'listening',
    currentTrack: null,
    placedPosition: null,
    claimedTitleArtist: false,
    steals: [],
    usedTrackIds: [],
    winnerId: null,
    roundNumber: 0,
  };
}

export function toTimelineCard(track: CustomTrack): TimelineCard | null {
  if (!track.year) return null;
  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    year: track.year,
  };
}

/** Tijdlijn blijft altijd oplopend op jaartal, oudste links. */
export function insertIntoTimeline(
  timeline: TimelineCard[],
  card: TimelineCard,
  position: number
): TimelineCard[] {
  const next = [...timeline];
  next.splice(Math.max(0, Math.min(position, timeline.length)), 0, card);
  return next;
}

/**
 * Klopt de gekozen positie?
 *
 * Positie i betekent: tussen kaart i-1 en kaart i. Goed als het jaartal niet
 * kleiner is dan de kaart links en niet groter dan die rechts. Gelijke jaren
 * mogen in willekeurige volgorde, dus daar zijn beide kanten goed.
 */
export function isPlacementCorrect(
  timeline: TimelineCard[],
  year: number,
  position: number
): boolean {
  const left = position > 0 ? timeline[position - 1] : null;
  const right = position < timeline.length ? timeline[position] : null;

  if (left && year < left.year) return false;
  if (right && year > right.year) return false;
  return true;
}

/** Alle posities die correct zouden zijn — voor het tonen van de juiste plek. */
export function correctPositions(timeline: TimelineCard[], year: number): number[] {
  const result: number[] = [];
  for (let i = 0; i <= timeline.length; i++) {
    if (isPlacementCorrect(timeline, year, i)) result.push(i);
  }
  return result;
}

export interface ResolveOutcome {
  state: ClassicGameState;
  /** Wat er gebeurde, om aan tafel te laten zien */
  summary: {
    placementCorrect: boolean;
    cardWonBy: string | null;
    tokenEarnedBy: string | null;
    failedStealers: string[];
    successfulStealerId: string | null;
  };
}

/**
 * Rekent de beurt af: plaatsing controleren, stelen afhandelen, munten
 * uitdelen en kijken of iemand tien kaarten heeft.
 *
 * Volgorde volgt het bordspel: plaatst de actieve speler goed, dan houdt hij
 * de kaart en zijn alle claims verloren. Plaatst hij fout, dan mag een
 * tegenstander die wél goed gokte de kaart stelen.
 */
export function resolveTurn(state: ClassicGameState): ResolveOutcome {
  const track = state.currentTrack;
  const active = state.players[state.activePlayerIndex];
  const card = track ? toTimelineCard(track) : null;

  if (!card || state.placedPosition === null || !active) {
    return {
      state: { ...state, phase: 'revealed' },
      summary: {
        placementCorrect: false,
        cardWonBy: null,
        tokenEarnedBy: null,
        failedStealers: [],
        successfulStealerId: null,
      },
    };
  }

  const placementCorrect = isPlacementCorrect(active.timeline, card.year, state.placedPosition);

  // Alleen als de actieve speler misplaatst, maakt een claim kans
  let successfulStealerId: string | null = null;
  const failedStealers: string[] = [];

  for (const claim of state.steals) {
    const claimer = state.players.find(p => p.id === claim.playerId);
    if (!claimer) continue;

    const claimCorrect =
      !placementCorrect && isPlacementCorrect(active.timeline, card.year, claim.position);

    if (claimCorrect && !successfulStealerId) {
      successfulStealerId = claimer.id;
    } else {
      failedStealers.push(claimer.id);
    }
  }

  const players = state.players.map(p => {
    let timeline = p.timeline;
    let tokens = p.tokens;

    if (p.id === active.id) {
      if (placementCorrect) {
        timeline = insertIntoTimeline(p.timeline, card, state.placedPosition!);
      }
      // Titel + artiest goed levert een munt op, ook bij een foute plaatsing
      if (state.claimedTitleArtist) {
        tokens = Math.min(MAX_TOKENS, tokens + 1);
      }
    }

    if (p.id === successfulStealerId) {
      // Gestolen kaart komt op de juiste plek in de eigen tijdlijn
      const own = correctPositions(p.timeline, card.year)[0] ?? p.timeline.length;
      timeline = insertIntoTimeline(p.timeline, card, own);
      // Een geslaagde steal kost de ingezette munt
      tokens = Math.max(0, tokens - 1);
    } else if (failedStealers.includes(p.id)) {
      tokens = Math.max(0, tokens - 1);
    }

    return { ...p, timeline, tokens };
  });

  const winner = players.find(p => p.timeline.length >= CARDS_TO_WIN);

  return {
    state: {
      ...state,
      players,
      phase: 'revealed',
      winnerId: winner ? winner.id : null,
    },
    summary: {
      placementCorrect,
      cardWonBy: placementCorrect ? active.id : successfulStealerId,
      tokenEarnedBy: state.claimedTitleArtist ? active.id : null,
      failedStealers,
      successfulStealerId,
    },
  };
}

/** Beurt doorgeven en klaarzetten voor het volgende nummer. */
export function nextTurn(state: ClassicGameState): ClassicGameState {
  const usedTrackIds = state.currentTrack
    ? [...state.usedTrackIds, state.currentTrack.id]
    : state.usedTrackIds;

  return {
    ...state,
    activePlayerIndex: (state.activePlayerIndex + 1) % Math.max(1, state.players.length),
    phase: 'listening',
    currentTrack: null,
    placedPosition: null,
    claimedTitleArtist: false,
    steals: [],
    usedTrackIds,
    roundNumber: state.roundNumber + 1,
  };
}

/**
 * Een nog niet gespeeld nummer met bekend jaartal.
 *
 * Kaarten die al in een tijdlijn liggen worden altijd overgeslagen: dezelfde
 * titel twee keer op één tijdlijn ziet er kapot uit. Raakt een kleine
 * afspeellijst op, dan mogen eerder gespeelde maar niet-gewonnen nummers
 * terugkomen; anders zou het spel doodlopen.
 */
export function drawTrack(
  tracks: CustomTrack[],
  usedTrackIds: string[],
  players: ClassicPlayer[] = []
): CustomTrack | null {
  const onTimelines = new Set(
    players.flatMap(p => p.timeline.map(c => c.trackId))
  );

  const withYear = tracks.filter(t => t.year && !onTimelines.has(t.id));
  const fresh = withYear.filter(t => !usedTrackIds.includes(t.id));

  const pool = fresh.length > 0 ? fresh : withYear;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Mag deze speler nu HITSTER roepen? */
export function canSteal(state: ClassicGameState, playerId: string, position: number): boolean {
  if (state.phase !== 'placed') return false;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.tokens < 1) return false;
  if (player.id === state.players[state.activePlayerIndex]?.id) return false;
  if (state.steals.some(s => s.playerId === playerId)) return false;
  // Eén munt per positie; een ander moet een andere plek kiezen
  if (state.steals.some(s => s.position === position)) return false;
  return true;
}

/** Drie munten inruilen voor een gratis, correct geplaatste kaart. */
export function canBuyFreeCard(player: ClassicPlayer): boolean {
  return player.tokens >= TOKENS_FOR_FREE_CARD;
}

/** Toegestane fragmentlengtes in seconden. */
export const SNIPPET_LENGTHS = [5, 10, 15, 20, 25, 30] as const;

export type SnippetStart = 'begin' | 'random';

export interface ClassicSettings {
  snippetSeconds: number;
  snippetStart: SnippetStart;
}

export const DEFAULT_SETTINGS: ClassicSettings = {
  snippetSeconds: 25,
  snippetStart: 'begin',
};

/** Als de lengte onbekend is, gaan we uit van een doorsnee popnummer. */
const ASSUMED_DURATION_MS = 3.5 * 60 * 1000;

/**
 * Kiest waar het fragment begint.
 *
 * Bij 'random' blijft de eerste 15% buiten beeld — intro's zijn vaak juist het
 * herkenbaarste stukje — en eindigt het fragment ruim voor de laatste 10%, om
 * niet in de fade-out of de stilte te belanden. Past het fragment niet binnen
 * die marges, dan begint het gewoon bij het begin.
 */
export function pickStartMs(
  durationMs: number | undefined,
  snippetSeconds: number,
  mode: SnippetStart
): number {
  if (mode === 'begin') return 0;

  const duration = durationMs && durationMs > 0 ? durationMs : ASSUMED_DURATION_MS;
  const snippetMs = snippetSeconds * 1000;

  const earliest = Math.floor(duration * 0.15);
  const latest = Math.floor(duration * 0.9) - snippetMs;

  if (latest <= earliest) return 0;
  return earliest + Math.floor(Math.random() * (latest - earliest));
}
