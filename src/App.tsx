import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { RoomLobby } from './components/RoomLobby';
import { DiscoBallSpinner } from './components/DiscoBallSpinner';
import { HitsterDiscoBall } from './components/HitsterDiscoBall';
import { AnswerBox } from './components/AnswerBox';
import { ClassicGame } from './components/ClassicGame';
import { createInitialState, createPlayer, type ClassicGameState } from './utils/classicGame';
import { JoinRoomModal } from './components/JoinRoomModal';
import { useRoom } from './utils/useRoom';
import { Timer25s } from './components/Timer25s';
import { BingoGrid } from './components/BingoGrid';
import { VictoryModal } from './components/VictoryModal';
import { RulesModal } from './components/RulesModal';
import { PlaylistStudio } from './components/PlaylistStudio';
import { Scoreboard } from './components/Scoreboard';
import { BlindAudioPlayer } from './components/BlindAudioPlayer';
import type { BingoCategory, BingoTile, CustomPlaylist, CustomTrack, GameMode, GridSize, HitsterColor, Language } from './types/hitster';
import { checkBingoWin, generateBingoBoard, generateHitsterBoard, generateRoomSeed, getCategoriesForMode } from './utils/bingoEngine';
import { getHitsterCategories } from './data/hitsterCategories';
import { soundEffects } from './utils/soundEffects';
import { getTranslation } from './utils/translations';
import { OFFICIAL_HITSTER_DECK } from './data/hitsterDeck';
import { ArrowLeft, RefreshCw, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function App() {
  const [language, setLanguage] = useState<Language>('nl');
  const [isMuted, setIsMuted] = useState(false);
  const [isCampfirePlaying, setIsCampfirePlaying] = useState(false);

  const [roomCode, setRoomCode] = useState<string>('');
  const [gameMode, setGameMode] = useState<GameMode>('sideA');
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [isInGame, setIsInGame] = useState(false);

  const [tiles, setTiles] = useState<BingoTile[]>([]);
  const [activeCategory, setActiveCategory] = useState<BingoCategory | undefined>();
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [hasWin, setHasWin] = useState(false);
  const [playerSeed] = useState(() => Math.floor(Math.random() * 10000));

  const [activePlaylist, setActivePlaylist] = useState<CustomPlaylist | null>(null);

  // Het nummer dat nu blind speelt. Woonde eerst alleen in BlindAudioPlayer,
  // waardoor het bingobord het jaartal nooit kreeg en de gok-feedback stil bleef.
  const [currentTrack, setCurrentTrack] = useState<CustomTrack | null>(null);
  const [isTrackRevealed, setIsTrackRevealed] = useState(false);
  // Loopt op bij elke nieuwe kaart, zodat de gok-invoer zichzelf reset
  const [roundKey, setRoundKey] = useState(0);

  // Hitster Bingo-modus: de discobal wijst een kleur aan en die bepaalt wat er
  // geraden moet worden. Alleen vakjes van die kleur mogen daarna afgekruist.
  const [activeColor, setActiveColor] = useState<HitsterColor | undefined>();
  const [answerWasCorrect, setAnswerWasCorrect] = useState(false);
  // Eén goed antwoord geeft precies één kruisje. Los bijhouden, want de
  // verdict-callback bevestigt "goed" opnieuw bij elke render.
  const [hasMarkedThisRound, setHasMarkedThisRound] = useState(false);

  // Klassieke tijdlijn-modus draait op een eigen spelstaat
  const [classicState, setClassicState] = useState<ClassicGameState | null>(null);
  const [localPlayerId] = useState(() => `p_${Math.random().toString(36).slice(2, 9)}`);

  const isClassicMode = gameMode === 'classic';
  const isHitsterMode = gameMode === 'sideA' || gameMode === 'sideB';
  const hitsterCategories = getHitsterCategories(gameMode);
  const activeHitsterCategory = activeColor
    ? hitsterCategories.find(c => c.color === activeColor)
    : undefined;

  // Gedeelde kamer: spelerslijst en spelstaat lopen hierlangs
  const room = useRoom();
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  const [showVictory, setShowVictory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPlaylistStudio, setShowPlaylistStudio] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showQRShare, setShowQRShare] = useState(false);

  const activeTrackDeck = activePlaylist && activePlaylist.tracks.length > 0
    ? activePlaylist.tracks
    : OFFICIAL_HITSTER_DECK;

  useEffect(() => {
    // Handle Spotify OAuth callback first
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      import('./utils/spotifyAuth').then(({ handleSpotifyCallback }) => {
        handleSpotifyCallback().then((success) => {
          if (success) {
            console.log('[App] Spotify OAuth login successful!');
            // Open PlaylistStudio after successful auth
            setShowPlaylistStudio(true);
          }
        });
      });
      return; // Don't process other params when handling OAuth
    }

    const room = params.get('room');
    const mode = params.get('mode') as GameMode;
    const grid = parseInt(params.get('grid') || '4', 10) as GridSize;

    if (room) {
      // Niet meteen starten: eerst een naam kiezen, want die vult het scorebord
      setRoomCode(room.toUpperCase());
      if (mode) setGameMode(mode);
      if (grid && [3, 4, 5].includes(grid)) setGridSize(grid);
      setPendingJoinCode(room.toUpperCase());
    }
  }, []);

  /** Meedoen aan een bestaande kamer met de gekozen naam. */
  const handleJoinWithName = async (name: string) => {
    if (!pendingJoinCode) return;
    const ok = await room.joinRoom(pendingJoinCode, name);
    if (!ok) return;
    setPendingJoinCode(null);
    handleStartGame(gameMode, gridSize, pendingJoinCode);
  };

  const handleStartGame = (mode: GameMode, grid: GridSize, code: string) => {
    setGameMode(mode);
    setGridSize(grid);
    setRoomCode(code);

    const roomSeed = generateRoomSeed(code);
    const useHitsterRules = mode === 'sideA' || mode === 'sideB';

    const initialTiles = useHitsterRules
      ? generateHitsterBoard(roomSeed, playerSeed, grid, mode, language, true)
      : generateBingoBoard(roomSeed, playerSeed, grid, mode, language, true, activeTrackDeck);

    setTiles(initialTiles);
    setIsInGame(true);
    setActiveColor(undefined);
    setAnswerWasCorrect(false);

    if (mode === 'classic') {
      setClassicState(createInitialState([
        createPlayer(localPlayerId, language === 'nl' ? 'Jij' : 'You', true),
      ]));
    }

    // Host opent de kamer, zodat anderen via de QR-code kunnen binnenkomen
    if (!room.roomCode) {
      room.createRoom(code, mode, language === 'nl' ? 'Host' : 'Host');
    }

    if (!useHitsterRules) {
      const categories = getCategoriesForMode(mode, activeTrackDeck);
      if (categories.length > 0) setActiveCategory(categories[0]);
    }
  };

  const handleTileClick = (index: number) => {
    const tile = tiles[index];
    if (!tile) return;

    // In Hitster-modus mag je alleen een vakje van de aangewezen kleur
    // afkruisen, en alleen als je antwoord goed was. Weghalen mag altijd,
    // voor als iemand zich vergist.
    if (isHitsterMode && !tile.isMarked) {
      const allowed = answerWasCorrect && !hasMarkedThisRound && tile.hitsterColor === activeColor;
      if (!allowed) {
        soundEffects.playTilePop(false);
        return;
      }
    }

    const newTiles = [...tiles];
    newTiles[index].isMarked = !newTiles[index].isMarked;
    setTiles(newTiles);
    soundEffects.playTilePop(newTiles[index].isMarked);

    // Elk goed antwoord levert precies één kruisje op
    if (isHitsterMode && newTiles[index].isMarked) {
      setHasMarkedThisRound(true);
    }

    const winResult = checkBingoWin(newTiles, gridSize);
    setHasWin(winResult.hasWin);
    setWinningIndices(winResult.winningIndices);
  };

  const handleCallBingo = () => {
    const winResult = checkBingoWin(tiles, gridSize);
    setHasWin(winResult.hasWin);
    setWinningIndices(winResult.winningIndices);
    setShowVictory(true);
  };

  const handleNewRound = () => {
    const nextSeed = Math.floor(Math.random() * 10000);
    const roomSeed = generateRoomSeed(roomCode);
    const newTiles = generateBingoBoard(roomSeed, nextSeed, gridSize, gameMode, language, true, activeTrackDeck);
    setTiles(newTiles);
    setHasWin(false);
    setWinningIndices([]);
    setShowVictory(false);
  };

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&mode=${gameMode}&grid=${gridSize}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <Navbar
        language={language}
        onLanguageChange={setLanguage}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundEffects.toggleMute())}
        isCampfirePlaying={isCampfirePlaying}
        onToggleCampfire={() => setIsCampfirePlaying(soundEffects.toggleCampfireCrackle())}
        onOpenRules={() => setShowRules(true)}
        onOpenPlaylistStudio={() => setShowPlaylistStudio(true)}
        onOpenScoreboard={() => setShowScoreboard(true)}
        roomCode={roomCode}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 z-10">
        {!isInGame ? (
          <RoomLobby
            language={language}
            onStartGame={handleStartGame}
            onJoinRoom={(code) => handleStartGame(gameMode, gridSize, code)}
            activeRoomCode={roomCode}
            onOpenPlaylistStudio={() => setShowPlaylistStudio(true)}
          />
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-3 rounded-2xl backdrop-blur-md">
              <button
                onClick={() => setIsInGame(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'nl' ? 'Kamer Verlaten' : 'Leave Game'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQRShare(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>#{roomCode}</span>
                </button>

                <button
                  onClick={handleNewRound}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                  title={getTranslation(language, 'newRound')}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isClassicMode && classicState ? (
              <ClassicGame
                state={classicState}
                setState={(updater) => setClassicState(prev => (prev ? updater(prev) : prev))}
                tracks={activeTrackDeck}
                language={language}
                localPlayerId={localPlayerId}
              />
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6 lg:col-span-1">
                {isHitsterMode ? (
                  <HitsterDiscoBall
                    categories={hitsterCategories}
                    activeColor={activeColor}
                    onColorSelected={(color) => {
                      setActiveColor(color);
                      setAnswerWasCorrect(false);
                      setHasMarkedThisRound(false);
                    }}
                    language={language}
                  />
                ) : (
                  <DiscoBallSpinner
                    categories={getCategoriesForMode(gameMode, activeTrackDeck)}
                    activeCategory={activeCategory}
                    onCategorySelected={setActiveCategory}
                    language={language}
                  />
                )}
                <BlindAudioPlayer
                  tracks={activeTrackDeck}
                  language={language}
                  onTrackDrawn={(track) => {
                    setCurrentTrack(track);
                    setIsTrackRevealed(false);
                    setRoundKey(k => k + 1);
                    setAnswerWasCorrect(false);
                    setHasMarkedThisRound(false);
                  }}
                  onRevealChange={setIsTrackRevealed}
                />
                <Timer25s language={language} />
              </div>

              <div className="lg:col-span-2">
                {isHitsterMode && (
                  <AnswerBox
                    key={roundKey}
                    category={activeHitsterCategory}
                    track={currentTrack}
                    isRevealed={isTrackRevealed}
                    language={language}
                    onVerdict={(v) => setAnswerWasCorrect(!!v?.correct)}
                  />
                )}
                <BingoGrid
                  tiles={tiles}
                  gridSize={gridSize}
                  winningIndices={winningIndices}
                  onTileClick={handleTileClick}
                  onCallBingo={handleCallBingo}
                  hasWin={hasWin}
                  language={language}
                  // Pas ná het onthullen doorgeven, anders verklapt de
                  // gok-feedback het antwoord tijdens de 25 seconden
                  actualYear={isTrackRevealed ? currentTrack?.year : undefined}
                  roundKey={roundKey}
                  hideYearGuess={isHitsterMode}
                  markableColor={answerWasCorrect && !hasMarkedThisRound ? activeColor : undefined}
                />
              </div>
            </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 z-10 border-t border-slate-900">
        <p>Hitster Bingo Campfire Edition • Smart Playlist Optimizer • Ready for Vercel ⛺🎶</p>
      </footer>

      {showVictory && (
        <VictoryModal
          language={language}
          onClose={() => setShowVictory(false)}
          onNewRound={handleNewRound}
        />
      )}

      {showRules && <RulesModal language={language} onClose={() => setShowRules(false)} />}

      {showPlaylistStudio && (
        <PlaylistStudio
          language={language}
          onClose={() => setShowPlaylistStudio(false)}
          onSelectPlaylist={setActivePlaylist}
        />
      )}

      {showScoreboard && (
        <Scoreboard
          language={language}
          onClose={() => setShowScoreboard(false)}
          roomPlayers={room.players}
          roomCode={room.roomCode}
          roomStatus={room.status}
          roomError={room.error}
          myPlayerId={room.myPlayerId}
          // Kaarten en munten komen uit de lopende klassieke partij
          liveStats={classicState
            ? Object.fromEntries(classicState.players.map(p => [
                p.id, { cards: p.timeline.length, tokens: p.tokens },
              ]))
            : undefined}
        />
      )}

      {pendingJoinCode && (
        <JoinRoomModal
          roomCode={pendingJoinCode}
          language={language}
          status={room.status}
          error={room.error}
          onJoin={handleJoinWithName}
          onCancel={() => setPendingJoinCode(null)}
        />
      )}

      {showQRShare && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full text-center text-slate-100 shadow-2xl relative">
            <h3 className="font-black text-lg text-amber-200 mb-1">
              Kamer Code / Room Code: <span className="font-mono text-amber-400">#{roomCode}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Scan met je telefoon camera om direct mee te doen!
            </p>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              <QRCodeSVG value={roomUrl} size={180} level="M" />
            </div>
            <button
              onClick={() => setShowQRShare(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase"
            >
              {getTranslation(language, 'close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
