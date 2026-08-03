import React, { useState, useEffect } from 'react';
import { Lock, RotateCcw, CheckCircle2, XCircle, HelpCircle, Timer } from 'lucide-react';
import type { CustomTrack, HitsterCategory, Language } from '../types/hitster';
import { checkAnswer, type AnswerVerdict } from '../utils/answerCheck';
import { soundEffects } from '../utils/soundEffects';

interface AnswerBoxProps {
  category?: HitsterCategory;
  track?: CustomTrack | null;
  /** Pas na het onthullen wordt er nagekeken */
  isRevealed: boolean;
  language: Language;
  onVerdict?: (verdict: AnswerVerdict | null) => void;
}

/**
 * Invulvak voor de ronde. Welk soort antwoord gevraagd wordt hangt af van de
 * kleur die de discobal aanwees, dus de invoer verandert mee: een jaartal-veld
 * voor jaar en decennium, en keuzeknoppen voor de ja/nee-achtige categorieën.
 */
export const AnswerBox: React.FC<AnswerBoxProps> = ({
  category,
  track,
  isRevealed,
  language,
  onVerdict
}) => {
  const [answer, setAnswer] = useState('');
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);

  const isNl = language === 'nl';

  // Nakijken zodra het antwoord bekend mag zijn
  useEffect(() => {
    if (!isRevealed || !category || !track || !locked) {
      if (!isRevealed) {
        setVerdict(null);
        onVerdict?.(null);
      }
      return;
    }
    const v = checkAnswer(answer, category, track, language);
    setVerdict(v);
    onVerdict?.(v);
    if (v.correct) soundEffects.playTilePop(true);
  }, [isRevealed, category, track, locked, answer, language, onVerdict]);

  const handleLock = (value?: string) => {
    const final = (value ?? answer).trim();
    if (!final) return;
    setAnswer(final);
    setLocked(true);
    soundEffects.playTilePop(true);
  };

  if (!category) {
    return (
      <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-4 mb-4 text-center">
        <p className="text-xs text-slate-400">
          {isNl
            ? 'Draai eerst aan de discobal om te bepalen wat je moet raden.'
            : 'Spin the disco ball first to see what to guess.'}
        </p>
      </div>
    );
  }

  const isChoice = category.answerType === 'beforeAfter' || category.answerType === 'soloGroup';
  const isNumeric = category.answerType === 'year' || category.answerType === 'decade';

  const choices: string[] = category.answerType === 'beforeAfter'
    ? [isNl ? `vóór ${category.pivotYear}` : `before ${category.pivotYear}`,
       isNl ? `vanaf ${category.pivotYear}` : `from ${category.pivotYear}`]
    : [isNl ? 'solo' : 'solo', isNl ? 'groep' : 'group'];

  return (
    <div className={`w-full rounded-2xl p-3.5 sm:p-4 mb-4 text-left shadow-lg border bg-slate-900/90 ${
      verdict
        ? verdict.correct
          ? 'border-green-500/60'
          : verdict.needsManualCheck ? 'border-amber-500/60' : 'border-red-500/50'
        : 'border-slate-700'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-full ${category.dotClass}`} />
          <span>{isNl ? category.labelNl : category.labelEn}</span>
        </label>
        {locked && !isRevealed && (
          <span className="text-[10px] bg-green-500/20 text-green-300 font-bold px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {isNl ? 'Vastgezet' : 'Locked'}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mb-2.5">
        {isNl ? category.hintNl : category.hintEn}
      </p>

      {!locked ? (
        isChoice ? (
          <div className="grid grid-cols-2 gap-2">
            {choices.map(choice => (
              <button
                key={choice}
                onClick={() => handleLock(choice)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-slate-200 hover:border-amber-500 hover:text-amber-300 transition-colors capitalize"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); handleLock(); }}
            className="flex gap-2"
          >
            <input
              type={isNumeric ? 'number' : 'text'}
              inputMode={isNumeric ? 'numeric' : 'text'}
              min={isNumeric ? 1900 : undefined}
              max={isNumeric ? 2030 : undefined}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                category.answerType === 'title'
                  ? (isNl ? 'Titel van het nummer' : 'Song title')
                  : category.answerType === 'artist'
                  ? (isNl ? 'Naam van de artiest' : 'Artist name')
                  : category.answerType === 'decade'
                  ? (isNl ? 'bijv. 1980' : 'e.g. 1980')
                  : (isNl ? 'bijv. 1984' : 'e.g. 1984')
              }
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-sm text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isNl ? 'Vastzetten' : 'Lock in'}</span>
            </button>
          </form>
        )
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-700">
            <span className="font-bold text-sm text-slate-100 capitalize">
              {isNl ? 'Jouw antwoord: ' : 'Your answer: '}
              <span className="text-amber-300">{answer}</span>
            </span>
            {!isRevealed && (
              <button
                onClick={() => { setLocked(false); soundEffects.playTilePop(false); }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px]">{isNl ? 'Aanpassen' : 'Change'}</span>
              </button>
            )}
          </div>

          {!isRevealed && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              {isNl
                ? 'Wachten tot het fragment is afgelopen…'
                : 'Waiting for the snippet to finish…'}
            </p>
          )}

          {verdict && (
            <div className={`p-2.5 rounded-xl text-xs font-bold flex items-start gap-2 animate-fade-in ${
              verdict.correct
                ? 'bg-green-500/20 text-green-200 border border-green-400/50'
                : verdict.needsManualCheck
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                : 'bg-red-500/15 text-red-200 border border-red-400/40'
            }`}>
              {verdict.correct
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : verdict.needsManualCheck
                ? <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div>
                <p>{verdict.message}</p>
                {verdict.correct && (
                  <p className="mt-1 font-extrabold">
                    {isNl
                      ? `Kruis één ${labelForColor(category, isNl)} vakje af!`
                      : `Cross off one ${labelForColor(category, isNl)} tile!`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function labelForColor(category: HitsterCategory, isNl: boolean): string {
  const nl: Record<string, string> = {
    green: 'groen', pink: 'roze', yellow: 'geel', purple: 'paars', blue: 'blauw',
  };
  const en: Record<string, string> = {
    green: 'green', pink: 'pink', yellow: 'yellow', purple: 'purple', blue: 'blue',
  };
  return (isNl ? nl : en)[category.color] ?? category.color;
}
