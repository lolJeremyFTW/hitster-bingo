import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Eye, Shuffle, Disc, HelpCircle, Sparkles, Calendar, User, Music2, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import type { CustomTrack, Language } from '../types/hitster';
import { soundEffects } from '../utils/soundEffects';
import { spotifyPlayer, type PlayerStatus } from '../utils/spotifyPlayer';
import { getStoredClientId, logoutSpotify, initiateSpotifyLogin } from '../utils/spotifyAuth';

interface BlindAudioPlayerProps {
  tracks: CustomTrack[];
  language: Language;
  /** Lengte van het fragment in seconden */
  snippetSeconds?: number;
}

export const BlindAudioPlayer: React.FC<BlindAudioPlayerProps> = ({
  tracks,
  language,
  snippetSeconds = 25
}) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(snippetSeconds);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [startFromMiddle, setStartFromMiddle] = useState(false);

  // Fallback voor tracks die (nog) een 30s preview hebben — zeldzaam sinds
  // Spotify die in Development Mode heeft uitgezet, maar gratis en handig.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isNl = language === 'nl';
  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const canStream = !!currentTrack?.spotifyUri;

  useEffect(() => {
    spotifyPlayer.setEvents({
      onStatus: (status, detail) => {
        setPlayerStatus(status);
        setStatusDetail(detail ?? null);
      },
      onTick: (left) => setSecondsLeft(left),
      onSnippetEnd: () => {
        setIsPlaying(false);
        setSecondsLeft(snippetSeconds);
      },
    });
  }, [snippetSeconds]);

  // Speler netjes loskoppelen als de component verdwijnt, anders blijft er een
  // spookapparaat bij Spotify achter waar playback naartoe geroute kan worden.
  useEffect(() => {
    return () => {
      spotifyPlayer.disconnect();
    };
  }, []);

  const stopEverything = useCallback(() => {
    spotifyPlayer.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
    setSecondsLeft(snippetSeconds);
  }, [snippetSeconds]);

  const handleDrawSecretTrack = () => {
    if (tracks.length === 0) return;

    stopEverything();

    const randomIndex = Math.floor(Math.random() * tracks.length);
    setCurrentTrackIndex(randomIndex);
    setIsRevealed(false);
    setPlayedCount(prev => prev + 1);

    soundEffects.playSpinSelected();
  };

  const togglePlayAudio = async () => {
    if (!currentTrack) return;

    if (isPlaying) {
      stopEverything();
      return;
    }

    if (currentTrack.spotifyUri) {
      // Vanaf het midden beginnen maakt raden lastiger — intro's zijn vaak
      // herkenbaarder dan het nummer zelf. Ruwe schatting: 3,5 min gemiddeld.
      const startAt = startFromMiddle ? 60_000 : 0;
      setIsPlaying(true);
      setSecondsLeft(snippetSeconds);
      await spotifyPlayer.playSnippet(currentTrack.spotifyUri, snippetSeconds, startAt);
      return;
    }

    if (currentTrack.audioPreviewUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleReveal = () => {
    setIsRevealed(true);
    soundEffects.playBingoVictory();
  };

  /** Oude sessie weggooien en opnieuw autoriseren, nu mét de afspeel-scopes */
  const handleReauth = async () => {
    const clientId = getStoredClientId();
    if (!clientId) return;
    logoutSpotify();
    try {
      await initiateSpotifyLogin(clientId);
    } catch (err: any) {
      setStatusDetail(err.message);
    }
  };

  const progressPct = ((snippetSeconds - secondsLeft) / snippetSeconds) * 100;

  const renderPlayerWarning = () => {
    // Meest voorkomende oorzaak na een scope-uitbreiding: een geldig maar te
    // oud token. Direct oplosbaar, dus een knop erbij i.p.v. alleen uitleg.
    if (playerStatus === 'scope-error') {
      return (
        <div className="flex items-start gap-2 text-left bg-amber-500/10 border border-amber-500/40 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-[11px] text-amber-200 leading-relaxed">
              {isNl
                ? 'Je Spotify-sessie is van vóór de afspeelfunctie en mist de rechten om muziek te starten. Één keer opnieuw inloggen lost dit op.'
                : 'Your Spotify session predates the playback feature and lacks the required permissions. Logging in once more fixes this.'}
            </p>
            <button
              onClick={handleReauth}
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-[11px] uppercase tracking-wide"
            >
              {isNl ? 'Opnieuw inloggen bij Spotify' : 'Re-login with Spotify'}
            </button>
          </div>
        </div>
      );
    }

    if (playerStatus === 'no-premium') {
      return (
        <div className="flex items-start gap-2 text-left bg-amber-500/10 border border-amber-500/40 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200 leading-relaxed">
            {isNl
              ? 'Spotify Premium is vereist om hele nummers in de browser af te spelen. Zonder Premium blijft de speler stil.'
              : 'Spotify Premium is required to stream full tracks in the browser.'}
          </p>
        </div>
      );
    }

    if (playerStatus === 'auth-error' || playerStatus === 'error') {
      return (
        <div className="flex items-start gap-2 text-left bg-red-500/10 border border-red-500/40 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-200 leading-relaxed">
            {statusDetail || (isNl ? 'Speler niet beschikbaar.' : 'Player unavailable.')}
          </p>
        </div>
      );
    }

    if (currentTrack && !canStream && !currentTrack.audioPreviewUrl) {
      return (
        <div className="flex items-start gap-2 text-left bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {isNl
              ? 'Dit nummer heeft geen Spotify-koppeling. Importeer de playlist opnieuw via "Login met Spotify" om te kunnen afspelen.'
              : 'This track has no Spotify link. Re-import the playlist via Spotify login to enable playback.'}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl text-center backdrop-blur-md relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-purple-400 flex items-center gap-1.5">
          <EyeOff className="w-4 h-4 text-purple-300" />
          <span>{isNl ? 'Blinde DJ Speler (Geheim)' : 'Blind DJ Player (Secret)'}</span>
        </h3>
        {playedCount > 0 && (
          <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30">
            Kaart #{playedCount}
          </span>
        )}
      </div>

      {!currentTrack ? (
        <div className="py-6 px-4 border border-dashed border-purple-500/30 rounded-xl bg-slate-950/60">
          <Disc className="w-10 h-10 text-purple-400 mx-auto mb-2 animate-spin-slow" />
          <p className="text-xs text-slate-300 mb-3 font-medium">
            {isNl
              ? `Trek een blinde kaart uit je afspeellijst en luister ${snippetSeconds} seconden zonder de titel of het jaar te zien!`
              : `Draw a secret card and listen for ${snippetSeconds} seconds without seeing the title or year!`}
          </p>
          <button
            onClick={handleDrawSecretTrack}
            className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 flex items-center gap-2 mx-auto"
          >
            <Shuffle className="w-4 h-4" />
            <span>{isNl ? 'Eerste Geheime Kaart Trekken' : 'Draw First Secret Card'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`relative p-5 rounded-2xl border-2 transition-all duration-500 ${
            isRevealed
              ? 'bg-gradient-to-tr from-purple-950 via-slate-900 to-slate-950 border-purple-400 shadow-xl shadow-purple-950/50'
              : 'bg-gradient-to-tr from-slate-950 via-purple-950/60 to-slate-950 border-purple-500/50 shadow-lg'
          }`}>
            {!isRevealed ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className={`w-16 h-16 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mb-3 ${isPlaying ? 'animate-pulse' : ''}`}>
                  {isPlaying ? (
                    <span className="text-2xl font-black text-purple-200 tabular-nums">{secondsLeft}</span>
                  ) : (
                    <HelpCircle className="w-8 h-8 text-purple-300" />
                  )}
                </div>
                <div className="font-extrabold text-sm text-purple-200 tracking-wide">
                  {isNl ? '❓ GEHEIM NUMMER' : '❓ SECRET TRACK'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isNl ? 'Luister goed! Raad het jaar, de artiest en vink je bingo kaart af.' : 'Listen closely! Guess the song and mark your bingo board.'}
                </p>

                {isPlaying && (
                  <div className="w-full max-w-xs h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-left space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-purple-500/30 pb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <h4 className="font-black text-lg text-yellow-200 leading-tight">
                    {currentTrack.title}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <User className="w-4 h-4 text-purple-400" />
                    <span>{currentTrack.artist}</span>
                  </div>

                  {currentTrack.year && (
                    <div className="flex items-center gap-1.5 text-amber-300 font-extrabold">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>Uitgebracht: {currentTrack.year}</span>
                    </div>
                  )}
                </div>

                {currentTrack.spotifyUrl && (
                  <a
                    href={currentTrack.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-green-400 hover:underline font-bold mt-1"
                  >
                    <Music2 className="w-3.5 h-3.5" />
                    <span>Open in Spotify</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {renderPlayerWarning()}

          {currentTrack.audioPreviewUrl && !canStream && (
            <audio
              ref={audioRef}
              src={currentTrack.audioPreviewUrl}
              onEnded={() => setIsPlaying(false)}
              preload="auto"
            />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={togglePlayAudio}
              disabled={playerStatus === 'loading' || (!canStream && !currentTrack.audioPreviewUrl)}
              className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-md shadow-purple-600/30"
            >
              {playerStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>
                {playerStatus === 'loading'
                  ? (isNl ? 'Verbinden…' : 'Connecting…')
                  : isPlaying
                    ? (isNl ? 'Stop' : 'Stop')
                    : (isNl ? `Speel ${snippetSeconds}s` : `Play ${snippetSeconds}s`)}
              </span>
            </button>

            {!isRevealed ? (
              <button
                onClick={handleReveal}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-yellow-500/30"
              >
                <Eye className="w-4 h-4" />
                <span>{isNl ? 'Onthul Antwoord 👁️' : 'Reveal Song 👁️'}</span>
              </button>
            ) : (
              <button
                onClick={handleDrawSecretTrack}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700"
              >
                <Shuffle className="w-4 h-4 text-purple-400" />
                <span>{isNl ? 'Volgend Geheim Nummer' : 'Next Secret Track'}</span>
              </button>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={startFromMiddle}
              onChange={(e) => setStartFromMiddle(e.target.checked)}
              className="accent-purple-500"
            />
            <span>{isNl ? 'Start midden in het nummer (moeilijker)' : 'Start mid-song (harder)'}</span>
          </label>
        </div>
      )}
    </div>
  );
};
