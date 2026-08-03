import React from 'react';
import { Flame, Volume2, VolumeX, Globe, BookOpen, Music, Trophy } from 'lucide-react';
import type { Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isCampfirePlaying: boolean;
  onToggleCampfire: () => void;
  onOpenRules: () => void;
  onOpenPlaylistStudio: () => void;
  onOpenScoreboard: () => void;
  roomCode?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  isMuted,
  onToggleMute,
  isCampfirePlaying,
  onToggleCampfire,
  onOpenRules,
  onOpenPlaylistStudio,
  onOpenScoreboard,
  roomCode
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-amber-500/20 px-4 py-3 text-white shadow-lg shadow-amber-950/20">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Vibe */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 p-0.5 shadow-md shadow-orange-500/30 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-amber-200 via-orange-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-sm">
              {getTranslation(language, 'appName')}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 font-medium">
              <span>{getTranslation(language, 'tagline')}</span>
              {roomCode && (
                <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
                  #{roomCode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Custom Playlist Studio */}
          <button
            onClick={onOpenPlaylistStudio}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 hover:bg-purple-950/50 hover:border-purple-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title={getTranslation(language, 'playlistStudioTitle')}
          >
            <Music className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">{getTranslation(language, 'modeCustom')}</span>
          </button>

          {/* Scoreboard */}
          <button
            onClick={onOpenScoreboard}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-amber-950/50 hover:border-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title={getTranslation(language, 'scoreboardTitle')}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{getTranslation(language, 'scoreboardTitle')}</span>
          </button>

          {/* Campfire Audio Crackle Toggle */}
          <button
            onClick={onToggleCampfire}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
              isCampfirePlaying
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/30 animate-pulse'
                : 'bg-slate-900 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title={getTranslation(language, 'campfireAudioToggle')}
          >
            <Flame className={`w-4 h-4 ${isCampfirePlaying ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden md:inline text-[11px]">⛺ Fire</span>
          </button>

          {/* Sound FX Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg border text-xs transition-all ${
              isMuted
                ? 'bg-red-950/40 border-red-800/60 text-red-400'
                : 'bg-slate-900 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title={getTranslation(language, 'soundToggle')}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Rules Modal Trigger */}
          <button
            onClick={onOpenRules}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
            title={getTranslation(language, 'rulesTitle')}
          >
            <BookOpen className="w-4 h-4 text-blue-400" />
          </button>

          {/* Language Selector */}
          <button
            onClick={() => onLanguageChange(language === 'nl' ? 'en' : 'nl')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 transition-all"
            title="Switch Language / Taal wijzigen"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{language.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
