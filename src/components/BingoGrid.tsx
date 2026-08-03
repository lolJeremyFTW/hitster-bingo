import React, { useState } from 'react';
import { Check, Info, Sparkles, Flame, HelpCircle } from 'lucide-react';
import type { BingoTile, GridSize, Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { soundEffects } from '../utils/soundEffects';

interface BingoGridProps {
  tiles: BingoTile[];
  gridSize: GridSize;
  winningIndices: number[];
  onTileClick: (index: number) => void;
  onCallBingo: () => void;
  hasWin: boolean;
  language: Language;
}

export const BingoGrid: React.FC<BingoGridProps> = ({
  tiles,
  gridSize,
  winningIndices,
  onTileClick,
  onCallBingo,
  hasWin,
  language
}) => {
  const [selectedHintTile, setSelectedHintTile] = useState<BingoTile | null>(null);

  const markedCount = tiles.filter(t => t.isMarked).length;

  const getGridColsClass = () => {
    switch (gridSize) {
      case 3:
        return 'grid-cols-3';
      case 4:
        return 'grid-cols-4';
      case 5:
        return 'grid-cols-5';
      default:
        return 'grid-cols-4';
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-between px-2 mb-3">
        <div className="text-xs text-amber-300/90 font-bold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            {markedCount} / {tiles.length} {getTranslation(language, 'markedCount')}
          </span>
        </div>
        {hasWin && (
          <span className="bg-amber-500/20 text-amber-300 text-xs font-black uppercase px-2.5 py-1 rounded-full border border-amber-400/50 animate-pulse">
            ✨ WINNING LINE READY!
          </span>
        )}
      </div>

      <div
        className={`w-full grid ${getGridColsClass()} gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-slate-950/90 border border-amber-500/30 shadow-2xl backdrop-blur-md relative`}
      >
        {tiles.map((tile, idx) => {
          const isWinningTile = winningIndices.includes(idx);
          const isFreeSpace = tile.categoryId === 'free_space';

          return (
            <div
              key={tile.id || idx}
              onClick={() => {
                if (!isFreeSpace) {
                  onTileClick(idx);
                }
              }}
              className={`relative aspect-square rounded-xl p-2 sm:p-3 flex flex-col items-center justify-between text-center select-none cursor-pointer transition-all duration-200 group transform active:scale-95 ${
                tile.isMarked
                  ? isWinningTile
                    ? 'bg-gradient-to-tr from-amber-600 via-yellow-500 to-orange-500 text-slate-950 shadow-lg shadow-yellow-500/40 ring-2 ring-yellow-300 animate-pulse'
                    : 'bg-gradient-to-tr from-amber-950/90 via-slate-900 to-slate-950 text-amber-300 border-2 border-amber-500/60 shadow-md shadow-amber-950/50'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-200 hover:border-amber-500/40 hover:bg-slate-850'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHintTile(tile);
                  soundEffects.playSpinTick(1.2);
                }}
                className="absolute top-1 right-1 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 opacity-70 group-hover:opacity-100 transition-opacity z-10"
                title={getTranslation(language, 'tileHint')}
              >
                <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              <div className="mt-1">
                {isFreeSpace ? (
                  <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-bounce" />
                ) : tile.isMarked ? (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-amber-500/40 group-hover:bg-amber-400 transition-colors" />
                )}
              </div>

              <span className={`text-[10px] sm:text-xs font-black leading-tight line-clamp-3 my-auto ${
                tile.isMarked ? 'text-amber-200' : 'text-slate-200'
              }`}>
                {tile.title}
              </span>

              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 opacity-60">
                {isFreeSpace ? 'FREE' : tile.isMarked ? '✓' : ''}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onCallBingo}
        className={`w-full mt-4 py-4 px-6 rounded-2xl font-black text-lg sm:text-xl uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl transform active:scale-95 ${
          hasWin
            ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-slate-950 hover:from-yellow-300 hover:to-orange-400 shadow-yellow-500/40 animate-bounce ring-4 ring-yellow-300'
            : 'bg-gradient-to-r from-amber-600 to-orange-600 text-slate-950 hover:from-amber-500 hover:to-orange-500 shadow-orange-500/20 opacity-90'
        }`}
      >
        <Sparkles className="w-6 h-6 animate-spin" />
        <span>{getTranslation(language, 'callBingo')}</span>
        <Sparkles className="w-6 h-6 animate-spin" />
      </button>

      {selectedHintTile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 max-w-sm w-full text-slate-100 shadow-2xl relative animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-base text-amber-200">
                {selectedHintTile.title}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 my-3 leading-relaxed">
              {selectedHintTile.description}
            </p>
            <button
              onClick={() => setSelectedHintTile(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
            >
              {getTranslation(language, 'close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
