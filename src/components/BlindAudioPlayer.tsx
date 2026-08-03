import React, { useState, useRef } from 'react';
import { Play, Pause, Eye, Shuffle, Disc, HelpCircle, Sparkles, Calendar, User, Music2, EyeOff } from 'lucide-react';
import type { CustomTrack, Language } from '../types/hitster';
import { soundEffects } from '../utils/soundEffects';

interface BlindAudioPlayerProps {
  tracks: CustomTrack[];
  language: Language;
}

export const BlindAudioPlayer: React.FC<BlindAudioPlayerProps> = ({
  tracks,
  language
}) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;

  const handleDrawSecretTrack = () => {
    if (tracks.length === 0) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const randomIndex = Math.floor(Math.random() * tracks.length);
    setCurrentTrackIndex(randomIndex);
    setIsRevealed(false);
    setIsPlaying(false);
    setPlayedCount(prev => prev + 1);

    soundEffects.playSpinSelected();
  };

  const togglePlayAudio = () => {
    if (!currentTrack) return;

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(true);
        });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReveal = () => {
    setIsRevealed(true);
    soundEffects.playBingoVictory();
  };

  const isNl = language === 'nl';

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
              ? 'Trek een blinde kaart uit je afspeellijst om de muziek af te spelen zonder de titel of het jaar te zien!'
              : 'Draw a secret card to play music without revealing the song name or release year!'}
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
                <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mb-3 animate-pulse">
                  <HelpCircle className="w-8 h-8 text-purple-300" />
                </div>
                <div className="font-extrabold text-sm text-purple-200 tracking-wide">
                  {isNl ? '❓ GEHEIM NUMMER AFSPELEN' : '❓ SECRET TRACK PLAYING'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isNl ? 'Luister goed! Raad het jaar, de artiest en vink je bingo kaart af.' : 'Listen closely! Guess the song and mark your bingo board.'}
                </p>
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

          {currentTrack.audioPreviewUrl && (
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
              className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-md shadow-purple-600/30"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pauze' : (isNl ? 'Speel Af' : 'Play')}</span>
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
        </div>
      )}
    </div>
  );
};
