import React, { useState, useCallback, useEffect } from 'react';
import { Coins, Eye, Users, Play, Pause, RotateCw, Trophy, Hand, Check, X, Settings2, Loader2, Volume2 } from 'lucide-react';
import type { CustomTrack, Language } from '../types/hitster';
import { ClassicTimeline } from './ClassicTimeline';
import {
  spotifyPlayer,
  fetchSpotifyDevices,
  isIosLikeDevice,
  type PlayerStatus,
  type SpotifyDevice,
} from '../utils/spotifyPlayer';
import { isSpotifyAuthenticated } from '../utils/spotifyAuth';
import { soundEffects } from '../utils/soundEffects';
import {
  type ClassicGameState,
  type ResolveOutcome,
  CARDS_TO_WIN,
  canSteal,
  correctPositions,
  drawTrack,
  nextTurn,
  resolveTurn,
  toTimelineCard,
  pickStartMs,
  SNIPPET_LENGTHS,
  countPlayable,
  DEFAULT_SETTINGS,
  type ClassicSettings,
} from '../utils/classicGame';

interface ClassicGameProps {
  state: ClassicGameState;
  setState: (updater: (prev: ClassicGameState) => ClassicGameState) => void;
  tracks: CustomTrack[];
  language: Language;
  /** Wie kijkt er op dit toestel mee; bepaalt wat je mag doen */
  localPlayerId: string;
  snippetSeconds?: number;
}

/**
 * Het klassieke Hitster-spel: nummer horen, kaart blind in je tijdlijn zetten,
 * tegenstanders mogen HITSTER roepen om te stelen, daarna de onthulling.
 *
 * Bedoeld voor een horizontaal gehouden telefoon: de tijdlijn van de actieve
 * speler krijgt de ruimte, de rest staat als strip bovenin.
 */
export const ClassicGame: React.FC<ClassicGameProps> = ({
  state,
  setState,
  tracks,
  language,
  localPlayerId,
  snippetSeconds = 25,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(snippetSeconds);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ResolveOutcome['summary'] | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(
    () => spotifyPlayer.getTargetDevice()
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ClassicSettings>(() => {
    const saved = localStorage.getItem('hitster_classic_settings');
    if (saved) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch { /* standaard */ }
    }
    return { ...DEFAULT_SETTINGS, snippetSeconds };
  });

  useEffect(() => {
    localStorage.setItem('hitster_classic_settings', JSON.stringify(settings));
  }, [settings]);

  const isNl = language === 'nl';
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = active?.id === localPlayerId;
  const me = state.players.find(p => p.id === localPlayerId);
  const viewed = state.players.find(p => p.id === viewedPlayerId) ?? active;
  const isViewingActive = viewed?.id === active?.id;

  /**
   * Eén telefoon is de speaker: die van de host, want daar is de playlist
   * geïmporteerd en dus de Spotify-sessie. Op de andere toestellen faalde het
   * afspelen stil — nu tonen we daar wie het nummer draait.
   *
   * Zonder gevonden speler (los spelen, geen kamer) mag dit toestel gewoon.
   */
  const host = state.players.find(p => p.isHost);
  const canControlPlayback = host ? host.id === localPlayerId : true;

  const playableCount = countPlayable(tracks);

  const activeDeviceName = targetDeviceId
    ? devices.find(d => d.id === targetDeviceId)?.name
      ?? (isNl ? 'Gekozen speaker' : 'Selected speaker')
    : isNl ? 'Deze browser' : 'This browser';

  const card = state.currentTrack ? toTimelineCard(state.currentTrack) : null;
  const correct = card && active ? correctPositions(active.timeline, card.year) : [];

  React.useEffect(() => {
    spotifyPlayer.setEvents({
      onStatus: (s, detail) => {
        setPlayerStatus(s);
        // 'auth-error' zat hier eerder niet bij, waardoor een toestel zonder
        // Spotify-sessie helemaal niets te zien kreeg: geen geluid, geen melding.
        const isProbleem =
          s === 'scope-error' || s === 'no-premium' || s === 'error' ||
          s === 'auth-error' || s === 'needs-gesture';
        setPlayerError(isProbleem ? detail ?? null : null);
        // Anders blijft de knop op "pauze" staan terwijl er niets speelt
        if (isProbleem) setIsPlaying(false);
      },
      onTick: setSecondsLeft,
      onSnippetEnd: () => { setIsPlaying(false); setSecondsLeft(settings.snippetSeconds); },
    });
  }, [settings.snippetSeconds]);

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      setDevices(await fetchSpotifyDevices());
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const handleSelectDevice = (deviceId: string | null) => {
    spotifyPlayer.setTargetDevice(deviceId);
    setTargetDeviceId(deviceId);
    setShowDevices(false);
    setPlayerError(null);
    setIsPlaying(false);
    if (!deviceId) spotifyPlayer.prewarm();
  };

  /**
   * Klaarzetten zodra de host het spel opent.
   *
   * Op een iPhone is de ingebouwde speler kansloos — Safari geeft het
   * audio-element van de Web Playback SDK niet vrij. Daar tonen we meteen de
   * speakerkeuze, zodat je de Spotify-app als speaker kunt pakken.
   *
   * Elders verbinden we alvast: de browser geeft geluid alleen vrij als
   * activateElement() binnen de tik zelf gebeurt, en bestaat de speler op dat
   * moment nog niet, dan valt er niets vrij te geven.
   */
  useEffect(() => {
    if (!canControlPlayback) return;
    if (!isSpotifyAuthenticated()) return;

    if (spotifyPlayer.getTargetDevice()) return;

    if (isIosLikeDevice()) {
      setShowDevices(true);
      void refreshDevices();
      return;
    }

    spotifyPlayer.prewarm();
  }, [canControlPlayback, refreshDevices]);

  const handleDraw = useCallback(() => {
    const track = drawTrack(tracks, state.usedTrackIds, state.players);
    if (!track) return;
    setState(prev => ({ ...prev, currentTrack: track, phase: 'listening', placedPosition: null, steals: [] }));
    setOutcome(null);
    setViewedPlayerId(null);
    soundEffects.playSpinSelected();
  }, [tracks, state.usedTrackIds, state.players, setState]);

  const handlePlay = useCallback(async () => {
    // MOET de eerste regel blijven: mobiele browsers geven het geluid alleen
    // vrij als dit synchroon binnen de tik gebeurt, dus vóór elke await.
    spotifyPlayer.activateFromGesture();

    if (!state.currentTrack?.spotifyUri) return;
    if (isPlaying) { spotifyPlayer.pause(); setIsPlaying(false); return; }

    // Elke keer opnieuw kiezen, zodat hetzelfde nummer niet steeds op dezelfde
    // plek begint als iemand het fragment herhaalt
    const startAt = pickStartMs(
      state.currentTrack.durationMs,
      settings.snippetSeconds,
      settings.snippetStart
    );

    setIsPlaying(true);
    setSecondsLeft(settings.snippetSeconds);

    const ok = await spotifyPlayer.playSnippet(
      state.currentTrack.spotifyUri,
      settings.snippetSeconds,
      startAt
    );

    // Niet gaan spelen? Dan mag de knop niet op "pauze" blijven staan — dat was
    // precies waarom het leek alsof er niets gebeurde.
    if (!ok) {
      setIsPlaying(false);
      setSecondsLeft(settings.snippetSeconds);
    }
  }, [state.currentTrack, isPlaying, settings]);

  const handlePlace = (position: number) => {
    setState(prev => ({ ...prev, placedPosition: position, phase: 'placed' }));
    soundEffects.playTilePop(true);
  };

  const handleSteal = (position: number) => {
    if (!canSteal(state, localPlayerId, position)) return;
    setState(prev => ({ ...prev, steals: [...prev.steals, { playerId: localPlayerId, position }] }));
    soundEffects.playTilePop(true);
  };

  const handleReveal = () => {
    spotifyPlayer.pause();
    setIsPlaying(false);
    const result = resolveTurn(state);
    setState(() => result.state);
    setOutcome(result.summary);
    if (result.summary.placementCorrect) soundEffects.playBingoVictory();
  };

  const handleNext = () => {
    setState(prev => nextTurn(prev));
    setOutcome(null);
    setViewedPlayerId(null);
    setSecondsLeft(snippetSeconds);
  };

  const winner = state.players.find(p => p.id === state.winnerId);

  if (winner) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-orange-500 text-slate-950 text-center shadow-2xl">
        <Trophy className="w-12 h-12 mx-auto mb-2" />
        <h2 className="text-2xl font-black">{winner.name} {isNl ? 'is de Hitster!' : 'is the Hitster!'}</h2>
        <p className="font-bold mt-1">
          {winner.timeline.length} {isNl ? 'kaarten op de juiste plek' : 'cards placed correctly'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Instellingen: fragmentlengte en waar het fragment begint */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
            showSettings
              ? 'bg-slate-800 border-amber-400 text-amber-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>
            {settings.snippetSeconds}s
            {settings.snippetStart === 'random' && (isNl ? ' · willekeurig' : ' · random')}
          </span>
        </button>

        {/* Spelersstrip: munten en kaarten van iedereen, klikbaar om te bekijken */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
        {state.players.map(p => {
          const isActive = p.id === active?.id;
          const isViewed = p.id === viewed?.id;
          return (
            <button
              key={p.id}
              onClick={() => setViewedPlayerId(p.id)}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                isViewed
                  ? 'bg-slate-800 border-amber-400'
                  : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
              } ${isActive ? 'ring-2 ring-amber-500/60' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-100 max-w-[7rem] truncate">{p.name}</span>
                {p.id === localPlayerId && (
                  <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded">
                    {isNl ? 'jij' : 'you'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black text-amber-300 flex items-center gap-0.5">
                  <Coins className="w-3 h-3" />{p.tokens}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {p.timeline.length}/{CARDS_TO_WIN}
                </span>
                {isActive && (
                  <span className="text-[9px] font-black text-amber-400 uppercase">
                    {isNl ? 'beurt' : 'turn'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {showSettings && (
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5">
              {isNl ? 'Lengte van het fragment' : 'Snippet length'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SNIPPET_LENGTHS.map(sec => (
                <button
                  key={sec}
                  onClick={() => setSettings(s => ({ ...s, snippetSeconds: sec }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    settings.snippetSeconds === sec
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5">
              {isNl ? 'Waar begint het fragment' : 'Where the snippet starts'}
            </div>
            <div className="flex gap-1.5">
              {([
                { key: 'begin' as const, nl: 'Vanaf het begin', en: 'From the start' },
                { key: 'random' as const, nl: 'Willekeurig', en: 'Random' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSettings(s => ({ ...s, snippetStart: opt.key }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    settings.snippetStart === opt.key
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {isNl ? opt.nl : opt.en}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              {settings.snippetStart === 'random'
                ? (isNl
                    ? 'Springt ergens het nummer in, maar niet in de intro of de fade-out. Elke keer opnieuw, dus herhalen geeft een ander stuk.'
                    : 'Jumps somewhere into the song, avoiding the intro and fade-out. Re-playing gives a different part.')
                : (isNl
                    ? 'Speelt vanaf 0:00, zoals bij het bordspel.'
                    : 'Plays from 0:00, like the board game.')}
            </p>
          </div>
        </div>
      )}

      {/* Speakerkeuze. Op iPhone is dit geen extraatje maar de enige route die
          werkt: Safari speelt de Web Playback SDK niet betrouwbaar af, dus laten
          we de Spotify-app op een toestel het werk doen via Spotify Connect. */}
      {canControlPlayback && isSpotifyAuthenticated() && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-700 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const opening = !showDevices;
                setShowDevices(opening);
                if (opening) void refreshDevices();
              }}
              className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
            >
              <Volume2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-200 truncate">
                {activeDeviceName}
              </span>
            </button>
            <button
              onClick={() => { setShowDevices(true); void refreshDevices(); }}
              disabled={devicesLoading}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-[10px] font-black uppercase text-slate-200 flex items-center gap-1"
            >
              {devicesLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RotateCw className="w-3.5 h-3.5" />}
              {isNl ? 'Speakers' : 'Speakers'}
            </button>
          </div>

          {showDevices && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {isNl
                  ? 'Staat je toestel er niet bij? Open de Spotify-app, speel daar één seconde iets af, en tik dan op Speakers.'
                  : 'Device missing? Open the Spotify app, play something for a second, then tap Speakers.'}
              </p>

              {devices.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleSelectDevice(d.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border text-[11px] font-bold flex items-center justify-between gap-2 ${
                    targetDeviceId === d.id
                      ? 'bg-green-500/15 border-green-500/50 text-green-200'
                      : 'bg-slate-950 border-slate-700 text-slate-200'
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-[9px] uppercase text-slate-400">{d.type}</span>
                </button>
              ))}

              {devices.length === 0 && !devicesLoading && (
                <p className="text-[11px] text-amber-200">
                  {isNl
                    ? 'Geen toestellen gevonden. Open de Spotify-app en speel daar even iets af.'
                    : 'No devices found. Open the Spotify app and play something briefly.'}
                </p>
              )}

              {/* Op iOS werkt dit niet, dus daar bieden we het niet aan */}
              {!isIosLikeDevice() && (
                <button
                  onClick={() => handleSelectDevice(null)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border text-[11px] font-bold ${
                    targetDeviceId === null
                      ? 'bg-green-500/15 border-green-500/50 text-green-200'
                      : 'bg-slate-950 border-slate-700 text-slate-200'
                  }`}
                >
                  {isNl ? 'Deze browser (ingebouwde speler)' : 'This browser (built-in player)'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alleen op het toestel dat daadwerkelijk afspeelt — de rest kan er niets mee */}
      {playerError && canControlPlayback && (
        <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
          playerStatus === 'needs-gesture'
            ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
            : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
        }`}>
          {playerError}
        </div>
      )}

      {/* Een deels gekoppelde afspeellijst is de vervelendste variant: het
          eerste nummer speelt, en dan ineens niet meer. Zeg dus hoeveel er
          bruikbaar is — die worden nu ook als enige getrokken. */}
      {canControlPlayback && playableCount > 0 && playableCount < tracks.length && (
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-[11px] text-slate-300 leading-relaxed">
          {isNl
            ? `${playableCount} van ${tracks.length} nummers heeft een Spotify-koppeling. Alleen die worden getrokken; de rest slaat het spel over. Importeer je playlist opnieuw met "Alles + afspeelbaar" om ze alsnog te koppelen.`
            : `${playableCount} of ${tracks.length} tracks have a Spotify link. Only those are drawn; the rest are skipped. Re-import with "All + playable" to link them.`}
        </div>
      )}

      {/* Zonder Spotify-URI kan de SDK niets afspelen; zeg dat, in plaats van
          alleen een uitgeschakelde knop te tonen */}
      {state.currentTrack && !state.currentTrack.spotifyUri && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed">
          {isNl
            ? 'Deze nummers hebben geen Spotify-koppeling, dus er is niets af te spelen. Open de Afspeellijst Studio, log in met Spotify en importeer je playlist met "Alles + afspeelbaar".'
            : 'These tracks have no Spotify link, so there is nothing to play. Open the Playlist Studio, log in with Spotify and import with "All + playable".'}
        </div>
      )}

      {/* Speler en fragment */}
      <div className="flex flex-wrap items-center gap-2 p-2 sm:p-3 rounded-2xl bg-slate-900/90 border border-slate-700">
        {!state.currentTrack ? (
          // De HOST trekt elke kaart, ook voor andermans beurt. De afspeellijst
          // leeft namelijk alleen op het host-toestel; liet je de actieve speler
          // zelf trekken, dan kwam de kaart uit het lege deck van diens telefoon
          // en was er voor niemand iets af te spelen.
          <button
            onClick={handleDraw}
            disabled={!canControlPlayback}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
          >
            <RotateCw className="w-4 h-4" />
            {canControlPlayback
              ? isMyTurn
                ? (isNl ? 'Trek een kaart' : 'Draw a card')
                : (isNl ? `Trek een kaart voor ${active?.name}` : `Draw a card for ${active?.name}`)
              : (isNl
                  ? `${host?.name ?? 'De host'} trekt de kaart…`
                  : `${host?.name ?? 'The host'} draws the card…`)}
          </button>
        ) : (
          <>
            {canControlPlayback ? (
              <button
                onClick={handlePlay}
                disabled={!state.currentTrack.spotifyUri || playerStatus === 'loading'}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs uppercase flex items-center gap-1.5"
              >
                {playerStatus === 'loading'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isPlaying
                    ? <Pause className="w-4 h-4" />
                    : <Play className="w-4 h-4 fill-current" />}
                {playerStatus === 'loading'
                  ? (isNl ? 'Verbinden…' : 'Connecting…')
                  : isPlaying
                    ? `${secondsLeft}s`
                    : (isNl ? `Speel ${settings.snippetSeconds}s` : `Play ${settings.snippetSeconds}s`)}
              </button>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 font-bold text-[11px] flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-slate-500" />
                {isNl
                  ? `${host?.name ?? 'De host'} speelt het nummer af`
                  : `${host?.name ?? 'The host'} plays the track`}
              </div>
            )}

            {state.phase !== 'revealed' && isMyTurn && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.claimedTitleArtist}
                  onChange={e => setState(prev => ({ ...prev, claimedTitleArtist: e.target.checked }))}
                  className="accent-amber-500"
                />
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{isNl ? 'Titel én artiest geraden' : 'Named title and artist'}</span>
              </label>
            )}

            {state.phase === 'placed' && (
              <button
                onClick={handleReveal}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                {isNl ? 'Draai de kaart om' : 'Flip the card'}
              </button>
            )}

            {state.phase === 'revealed' && (
              <button
                onClick={handleNext}
                className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-100 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <RotateCw className="w-4 h-4" />
                {isNl ? 'Volgende beurt' : 'Next turn'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Uitslag van de beurt */}
      {outcome && card && (
        <div className={`p-3 rounded-2xl border text-xs font-bold ${
          outcome.placementCorrect
            ? 'bg-green-500/15 border-green-500/50 text-green-200'
            : 'bg-red-500/15 border-red-500/40 text-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {outcome.placementCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span className="text-sm">
              {card.title} — {card.artist} ({card.year})
            </span>
          </div>
          <p>
            {outcome.placementCorrect
              ? (isNl ? `${active?.name} plaatste de kaart goed en houdt hem.` : `${active?.name} placed it correctly.`)
              : outcome.successfulStealerId
              ? (isNl
                  ? `Fout geplaatst! ${state.players.find(p => p.id === outcome.successfulStealerId)?.name} steelt de kaart.`
                  : `Wrong! ${state.players.find(p => p.id === outcome.successfulStealerId)?.name} steals it.`)
              : (isNl ? 'Fout geplaatst. De kaart gaat weg.' : 'Wrong placement. The card is discarded.')}
          </p>
          {outcome.tokenEarnedBy && (
            <p className="mt-1 text-amber-300 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              {isNl ? 'Munt verdiend voor titel én artiest.' : 'Token earned for title and artist.'}
            </p>
          )}
          {outcome.failedStealers.length > 0 && (
            <p className="mt-1 text-slate-400">
              {isNl ? 'Munt kwijt: ' : 'Lost a token: '}
              {outcome.failedStealers.map(id => state.players.find(p => p.id === id)?.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Tijdlijn van de bekeken speler */}
      <div className="p-2 sm:p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
        {/* Alleen benoemen wanneer je naar iemand anders kijkt; anders is het
            overbodige regel die verticale ruimte kost */}
        {!isViewingActive && (
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase font-black tracking-wider text-amber-400">
            <Users className="w-3.5 h-3.5" />
            <span>{isNl ? `Tijdlijn van ${viewed?.name}` : `${viewed?.name}'s timeline`}</span>
          </div>
        )}

        {viewed && (
          <ClassicTimeline
            player={viewed}
            language={language}
            canPlace={isViewingActive && isMyTurn && state.phase === 'listening' && !!state.currentTrack}
            onPlace={handlePlace}
            stealMarkers={isViewingActive ? state.steals.map(s => ({
              position: s.position,
              label: state.players.find(p => p.id === s.playerId)?.name.slice(0, 6) ?? '?',
            })) : []}
            correctPositions={state.phase === 'revealed' && isViewingActive ? correct : []}
            placedPosition={isViewingActive ? state.placedPosition : null}
            isRevealed={state.phase === 'revealed'}
            pendingCard={state.currentTrack && isViewingActive
              ? { title: state.currentTrack.title, artist: state.currentTrack.artist }
              : null}
          />
        )}
      </div>

      {/* Stelen: alleen voor wie niet aan de beurt is en munten heeft */}
      {state.phase === 'placed' && !isMyTurn && me && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-black text-red-200">
            <Hand className="w-4 h-4" />
            <span>{isNl ? 'HITSTER roepen?' : 'Call HITSTER?'}</span>
          </div>
          <p className="text-[11px] text-red-200/80 mb-2">
            {me.tokens < 1
              ? (isNl ? 'Je hebt geen munten om in te zetten.' : 'You have no tokens to spend.')
              : state.steals.some(s => s.playerId === localPlayerId)
              ? (isNl ? 'Je hebt al een munt ingezet deze beurt.' : 'You already placed a token this turn.')
              : (isNl
                  ? `Denk je dat ${active?.name} fout plaatst? Kies hierboven in de tijdlijn de plek waar de kaart volgens jou hoort. Klopt het, dan steel je de kaart.`
                  : `Think ${active?.name} is wrong? Pick the correct spot in the timeline above to steal the card.`)}
          </p>
          {me.tokens >= 1 && !state.steals.some(s => s.playerId === localPlayerId) && viewed && isViewingActive && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: (active?.timeline.length ?? 0) + 1 }, (_, i) => i)
                .filter(pos => !state.steals.some(s => s.position === pos))
                .map(pos => (
                  <button
                    key={pos}
                    onClick={() => handleSteal(pos)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Coins className="w-3 h-3" />
                    {isNl ? `Plek ${pos + 1}` : `Slot ${pos + 1}`}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
