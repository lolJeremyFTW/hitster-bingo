import React, { useState } from 'react';
import { Lock, CheckCircle2, Target, Sparkles, RotateCcw } from 'lucide-react';
import type { Language } from '../types/hitster';
import { soundEffects } from '../utils/soundEffects';

interface YearGuessBoxProps {
  language: Language;
  actualYear?: number;
}

export const YearGuessBox: React.FC<YearGuessBoxProps> = ({ language, actualYear }) => {
  const [guessYearInput, setGuessYearInput] = useState<string>('');
  const [lockedGuess, setLockedGuess] = useState<number | null>(null);

  const handleLockGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(guessYearInput, 10);
    if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2030) {
      setLockedGuess(parsed);
      soundEffects.playTilePop(true);
    }
  };

  const handleUnlock = () => {
    setLockedGuess(null);
    soundEffects.playTilePop(false);
  };

  const isNl = language === 'nl';

  let matchFeedback: { type: 'exact' | 'close' | 'decade' | 'miss'; message: string } | null = null;
  if (lockedGuess && actualYear) {
    const diff = Math.abs(lockedGuess - actualYear);
    const lockedDecade = Math.floor(lockedGuess / 10) * 10;
    const actualDecade = Math.floor(actualYear / 10) * 10;

    if (diff === 0) {
      matchFeedback = {
        type: 'exact',
        message: isNl
          ? '🏆 EXACT GOED GERADEN! Kruis de tegel "Exact Jaartal" af!'
          : '🏆 EXACT YEAR GUESSED! Mark "Exact Year" tile!'
      };
    } else if (diff <= 2) {
      matchFeedback = {
        type: 'close',
        message: isNl
          ? `🎯 SUPER DICHTBIJ! (Zat er ${diff} jaar naast). Kruis "Binnen 2 Jaar" of "${actualDecade}s" af!`
          : `🎯 SO CLOSE! (Off by ${diff} years). Mark "Within 2 Years" or "${actualDecade}s"!`
      };
    } else if (lockedDecade === actualDecade) {
      matchFeedback = {
        type: 'decade',
        message: isNl
          ? `✨ JUIST DECENNIUM (${actualDecade}s)! Kruis "Jaren ${actualDecade.toString().slice(2)}" af!`
          : `✨ CORRECT DECADE (${actualDecade}s)! Mark "${actualDecade}s" tile!`
      };
    } else {
      matchFeedback = {
        type: 'miss',
        message: isNl
          ? `Echte jaar was ${actualYear} (Jouw gok: ${lockedGuess}). Volgende ronde beter!`
          : `Actual year was ${actualYear} (Your guess: ${lockedGuess}). Next time!`
      };
    }
  }

  return (
    <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 mb-4 backdrop-blur-md text-left shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-amber-300" />
          <span>{isNl ? 'Gok je Jaartal (Vergrendel voor 25s)' : 'Lock in Your Year Guess'}</span>
        </label>
        {lockedGuess && (
          <span className="text-[10px] bg-green-500/20 text-green-300 font-bold px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3 text-green-400" />
            {isNl ? 'Gok Vastgezet' : 'Guess Locked'}
          </span>
        )}
      </div>

      {lockedGuess === null ? (
        <form onSubmit={handleLockGuess} className="flex gap-2">
          <input
            type="number"
            min={1940}
            max={2030}
            required
            value={guessYearInput}
            onChange={(e) => setGuessYearInput(e.target.value)}
            placeholder={isNl ? 'Vul jaartal in (bijv. 1984)' : 'Enter year (e.g. 1984)'}
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-sm text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!guessYearInput.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-md shadow-amber-500/20"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isNl ? 'Vastzetten' : 'Lock In'}</span>
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-green-500/40">
            <div className="flex items-center gap-2 font-mono font-black text-base text-green-300">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span>Jouw Gok: {lockedGuess}</span>
            </div>
            <button
              onClick={handleUnlock}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center gap-1"
              title="Aanpassen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[10px]">Aanpassen</span>
            </button>
          </div>

          {matchFeedback && (
            <div className={`p-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 animate-fade-in ${
              matchFeedback.type === 'exact'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/50'
                : matchFeedback.type === 'close'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                : matchFeedback.type === 'decade'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>{matchFeedback.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
