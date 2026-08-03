import React, { useState } from 'react';
import { Sparkles, Disc, RefreshCw } from 'lucide-react';
import type { BingoCategory, Language } from '../types/hitster';
import { soundEffects } from '../utils/soundEffects';
import { getTranslation } from '../utils/translations';

interface DiscoBallSpinnerProps {
  categories: BingoCategory[];
  activeCategory?: BingoCategory;
  onCategorySelected: (cat: BingoCategory) => void;
  language: Language;
}

export const DiscoBallSpinner: React.FC<DiscoBallSpinnerProps> = ({
  categories,
  activeCategory,
  onCategorySelected,
  language
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);

  const handleSpin = () => {
    if (isSpinning || categories.length === 0) return;

    setIsSpinning(true);
    let ticks = 0;
    const maxTicks = 20 + Math.floor(Math.random() * 10);
    let currentIdx = Math.floor(Math.random() * categories.length);

    setSpinDeg(prev => prev + 1080 + Math.floor(Math.random() * 360));

    const spinInterval = setInterval(() => {
      ticks++;
      currentIdx = (currentIdx + 1) % categories.length;
      onCategorySelected(categories[currentIdx]);
      soundEffects.playSpinTick(0.8 + (ticks / maxTicks) * 0.6);

      if (ticks >= maxTicks) {
        clearInterval(spinInterval);
        setIsSpinning(false);
        const finalCategory = categories[currentIdx];
        onCategorySelected(finalCategory);
        soundEffects.playSpinSelected();
      }
    }, 80 + ticks * 12);
  };

  const isNl = language === 'nl';

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl shadow-amber-950/30 text-center relative overflow-hidden backdrop-blur-md">
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <h2 className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mb-3 flex items-center justify-center gap-1.5">
        <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
        <span>{getTranslation(language, 'activeCategory')}</span>
      </h2>

      <div className="flex flex-col items-center justify-center my-2">
        <div className="relative group cursor-pointer" onClick={handleSpin}>
          <div
            className={`absolute -inset-2 rounded-full bg-gradient-to-r from-amber-500 via-purple-500 to-pink-500 opacity-60 blur-lg transition duration-500 group-hover:opacity-100 ${
              isSpinning ? 'animate-spin opacity-90' : ''
            }`}
          />

          <div
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 border-2 border-amber-400/50 flex items-center justify-center shadow-2xl transition-transform duration-1000 ease-out hover:scale-105"
            style={{ transform: `rotate(${spinDeg}deg)` }}
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />
            <Disc className={`w-16 h-16 text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] ${isSpinning ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <button
          onClick={handleSpin}
          disabled={isSpinning}
          className="mt-4 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>{isSpinning ? getTranslation(language, 'spinning') : getTranslation(language, 'spinDiscoBall')}</span>
        </button>
      </div>

      {activeCategory ? (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 text-left transition-all animate-fade-in shadow-inner">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 animate-ping" />
            <h3 className="font-extrabold text-base sm:text-lg text-amber-200">
              {isNl ? activeCategory.titleNl : activeCategory.titleEn}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {isNl ? activeCategory.descNl : activeCategory.descEn}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400 italic">
          {isNl ? 'Draai aan de discobal om de eerste ronde categorie te kiezen!' : 'Spin the disco ball to pick the first category!'}
        </p>
      )}
    </div>
  );
};
