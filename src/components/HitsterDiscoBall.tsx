import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { HitsterCategory, HitsterColor, Language } from '../types/hitster';
import { soundEffects } from '../utils/soundEffects';

interface HitsterDiscoBallProps {
  categories: HitsterCategory[];
  activeColor?: HitsterColor;
  onColorSelected: (color: HitsterColor) => void;
  language: Language;
  /** Blokkeert draaien zolang de ronde nog loopt */
  disabled?: boolean;
}

/**
 * De discobal uit Hitster Bingo: draaien wijst één van de vijf kleuren aan,
 * en die kleur bepaalt wat er deze ronde geraden moet worden.
 */
export const HitsterDiscoBall: React.FC<HitsterDiscoBallProps> = ({
  categories,
  activeColor,
  onColorSelected,
  language,
  disabled = false
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);
  const [highlight, setHighlight] = useState<HitsterColor | undefined>(activeColor);

  const isNl = language === 'nl';
  const activeCategory = categories.find(c => c.color === (activeColor ?? highlight));

  const handleSpin = () => {
    if (isSpinning || disabled || categories.length === 0) return;

    setIsSpinning(true);
    setSpinDeg(prev => prev + 1080 + Math.floor(Math.random() * 360));

    let ticks = 0;
    const maxTicks = 18 + Math.floor(Math.random() * 10);
    let idx = Math.floor(Math.random() * categories.length);

    const step = () => {
      ticks++;
      idx = (idx + 1) % categories.length;
      setHighlight(categories[idx].color);
      soundEffects.playSpinTick(0.8 + (ticks / maxTicks) * 0.6);

      if (ticks >= maxTicks) {
        setIsSpinning(false);
        onColorSelected(categories[idx].color);
        soundEffects.playSpinSelected();
        return;
      }
      // Vertragen naar het einde toe, alsof de bal uitrolt
      setTimeout(step, 70 + ticks * 14);
    };

    setTimeout(step, 70);
  };

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl shadow-amber-950/30 text-center relative overflow-hidden backdrop-blur-md">
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <h2 className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mb-3 flex items-center justify-center gap-1.5">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <span>{isNl ? 'Draai de discobal' : 'Spin the disco ball'}</span>
      </h2>

      <div className="flex flex-col items-center justify-center my-2">
        <button
          type="button"
          onClick={handleSpin}
          disabled={disabled || isSpinning}
          className="relative group disabled:cursor-not-allowed"
          aria-label={isNl ? 'Draai de discobal' : 'Spin the disco ball'}
        >
          <div
            className={`absolute -inset-2 rounded-full bg-gradient-to-r from-emerald-500 via-purple-500 to-pink-500 opacity-60 blur-lg transition duration-500 ${
              isSpinning ? 'animate-spin opacity-90' : 'group-hover:opacity-100'
            }`}
          />

          <div
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-amber-400/50 shadow-2xl transition-transform duration-1000 ease-out overflow-hidden"
            style={{ transform: `rotate(${spinDeg}deg)` }}
          >
            {/* Vijf taartpunten, één per categorie-kleur */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-3">
              {categories.map((cat, i) => (
                <div
                  key={cat.color}
                  className={`${cat.dotClass} transition-opacity duration-150 ${
                    highlight === cat.color ? 'opacity-100' : 'opacity-35'
                  } ${i === 4 ? 'col-span-2' : ''}`}
                />
              ))}
            </div>
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:10px_10px] opacity-30" />
            <div className="absolute inset-0 rounded-full ring-4 ring-inset ring-slate-950/40" />
          </div>
        </button>

        <button
          onClick={handleSpin}
          disabled={disabled || isSpinning}
          className="mt-4 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:transform-none"
        >
          <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>
            {isSpinning
              ? (isNl ? 'Draaien…' : 'Spinning…')
              : (isNl ? 'Draai discobal' : 'Spin disco ball')}
          </span>
        </button>
      </div>

      {activeCategory ? (
        <div className={`mt-4 p-4 rounded-xl bg-gradient-to-r ${activeCategory.tileClass} text-left animate-fade-in shadow-lg`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-white/90 shadow" />
            <h3 className="font-black text-base sm:text-lg text-white drop-shadow">
              {isNl ? activeCategory.labelNl : activeCategory.labelEn}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-white/90 font-medium">
            {isNl ? activeCategory.hintNl : activeCategory.hintEn}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400 italic">
          {isNl
            ? 'Draai aan de discobal om te bepalen wat je deze ronde moet raden.'
            : 'Spin the disco ball to decide what to guess this round.'}
        </p>
      )}
    </div>
  );
};
