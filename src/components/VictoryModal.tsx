import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Flame } from 'lucide-react';
import type { Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { soundEffects } from '../utils/soundEffects';

interface VictoryModalProps {
  language: Language;
  onClose: () => void;
  onNewRound: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  language,
  onClose,
  onNewRound
}) => {
  useEffect(() => {
    soundEffects.playBingoVictory();

    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899']
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-yellow-400 rounded-3xl p-6 max-w-md w-full text-center text-slate-100 shadow-2xl relative animate-bounce-short">
        <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 rounded-3xl opacity-50 blur-xl pointer-events-none animate-pulse" />

        <div className="relative">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 p-1 flex items-center justify-center shadow-lg shadow-yellow-500/50 mb-3 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10 text-yellow-400" />
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400">
            {getTranslation(language, 'bingoTitle')}
          </h2>

          <p className="text-sm text-amber-200 mt-2 max-w-xs mx-auto">
            {getTranslation(language, 'bingoSub')}
          </p>

          <div className="my-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-xs font-bold text-amber-300">
            <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
            <span>Kampvuur Winnaar! ⛺</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors border border-slate-700"
            >
              {getTranslation(language, 'continuePlaying')}
            </button>
            <button
              onClick={onNewRound}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:from-yellow-300 hover:to-orange-400 transition-colors shadow-lg shadow-yellow-500/30"
            >
              {getTranslation(language, 'newRound')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
