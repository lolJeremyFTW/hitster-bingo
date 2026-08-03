import React from 'react';
import { BookOpen, Sparkles, Disc, Clock, Flame, CheckCircle2 } from 'lucide-react';
import type { Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';

interface RulesModalProps {
  language: Language;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ language, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full text-slate-100 shadow-2xl relative my-auto animate-fade-in">
        <div className="flex items-center gap-2.5 mb-4 border-b border-slate-800 pb-3">
          <BookOpen className="w-6 h-6 text-amber-400" />
          <h2 className="font-black text-xl text-amber-200">
            {getTranslation(language, 'rulesTitle')}
          </h2>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-96 overflow-y-auto pr-1">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Disc className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">{getTranslation(language, 'rulesStep1')}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-purple-300">{getTranslation(language, 'rulesStep2')}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Clock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-cyan-300">{getTranslation(language, 'rulesStep3')}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-300">{getTranslation(language, 'rulesStep4')}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Flame className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-orange-300">{getTranslation(language, 'rulesStep5')}</div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
        >
          {getTranslation(language, 'close')}
        </button>
      </div>
    </div>
  );
};
