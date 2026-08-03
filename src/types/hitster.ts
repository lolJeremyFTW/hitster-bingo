export type GameMode = 'sideA' | 'sideB' | 'custom' | 'campfire';

export type GridSize = 3 | 4 | 5;

export type Language = 'nl' | 'en';

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
