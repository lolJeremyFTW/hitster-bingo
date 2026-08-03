export type GameMode = 'sideA' | 'sideB' | 'custom' | 'campfire' | 'classic';

export type GridSize = 3 | 4 | 5;

export type Language = 'nl' | 'en';

/** De vijf kleuren van de discobal; elke kleur is één categorie per zijde. */
export type HitsterColor = 'green' | 'pink' | 'yellow' | 'purple' | 'blue';

/**
 * Wat de speler moet invullen bij een categorie.
 * - year: een jaartal, goed binnen `tolerance` jaar
 * - decade: een decennium (1980 telt voor 1980-1989)
 * - beforeAfter: keuze rond een grensjaar
 * - soloGroup: keuze tussen solo-artiest en groep
 * - title / artist: vrije tekst, tolerant vergeleken
 */
export type AnswerType = 'year' | 'decade' | 'beforeAfter' | 'soloGroup' | 'title' | 'artist';

export interface HitsterCategory {
  color: HitsterColor;
  labelNl: string;
  labelEn: string;
  hintNl: string;
  hintEn: string;
  answerType: AnswerType;
  /** Alleen bij answerType 'year': toegestane afwijking in jaren */
  tolerance?: number;
  /** Alleen bij answerType 'beforeAfter': het grensjaar */
  pivotYear?: number;
  /** Tailwind-klassen voor de tegel */
  tileClass: string;
  dotClass: string;
}

export interface BingoCategory {
  id: string;
  titleNl: string;
  titleEn: string;
  descNl: string;
  descEn: string;
  iconName: string;
  color: string;
  tags: string[];
}

export interface BingoTile {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  iconName: string;
  color: string;
  isMarked: boolean;
  isWinningTile?: boolean;
  /** Kleur van dit vakje in de Hitster Bingo-modus */
  hitsterColor?: HitsterColor;
}

export interface CustomTrack {
  id: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  spotifyUrl?: string;
  /** spotify:track:… — wat de Web Playback SDK nodig heeft om af te spelen */
  spotifyUri?: string;
  /** Legacy 30s preview. Leeg voor apps in Development Mode sinds 27-11-2024. */
  audioPreviewUrl?: string;
  /** Bron van het jaartal, zodat je ziet of het origineel of een heruitgave is */
  yearSource?: 'spotify' | 'musicbrainz' | 'manual';
  /** Albumnaam — nodig om compilaties/remasters met een fout jaartal te herkennen */
  albumName?: string;
  /** Solo-artiest of groep, via MusicBrainz. Onbekend = spelers beoordelen zelf. */
  artistType?: 'person' | 'group' | 'unknown';
  /** Lengte van het nummer; nodig om een willekeurig fragment te kiezen
   *  dat niet voorbij het einde valt */
  durationMs?: number;
}

export interface CustomPlaylist {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tracks: CustomTrack[];
}

export interface GameRoomState {
  roomId: string;
  hostName: string;
  mode: GameMode;
  gridSize: GridSize;
  customPlaylistId?: string;
  includeFreeSpace: boolean;
  language: Language;
  seed: number;
  activeCategory?: BingoCategory;
  timerSeconds: number;
  isTimerRunning: boolean;
  roundNumber: number;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  bingoCount: number;
  tileCount: number;
}
