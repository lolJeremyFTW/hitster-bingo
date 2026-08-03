import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, AlertTriangle } from 'lucide-react';
import type { Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { soundEffects } from '../utils/soundEffects';

interface Timer25sProps {
  language: Language;
}

export const Timer25s: React.FC<Timer25sProps> = ({ language }) => {
  const [seconds, setSeconds] = useState(25);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: number | undefined;

    if (isRunning && seconds > 0) {
      interval = window.setInterval(() => {
        setSeconds(prev => {
          const nextSec = prev - 1;
          if (nextSec > 0) {
            soundEffects.playTimerTick(nextSec <= 5);
          } else if (nextSec === 0) {
            soundEffects.playTimerAlarm();
          }
          return nextSec;
        });
      }, 1000);
    } else if (seconds === 0) {
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, seconds]);

  const toggleTimer = () => {
    if (seconds === 0) {
      setSeconds(25);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSeconds(25);
  };

  const isUrgent = seconds <= 5 && seconds > 0;
  const isZero = seconds === 0;

  const progressPercent = (seconds / 25) * 100;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl text-center backdrop-blur-md relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'timer25s')}</span>
        </h3>
        {isZero && (
          <span className="bg-red-500/20 text-red-400 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-500/30 animate-bounce flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {getTranslation(language, 'timesUp')}
          </span>
        )}
      </div>

      <div className="relative my-3 flex flex-col items-center justify-center">
        <div
          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300 ${
            isZero
              ? 'border-red-500 bg-red-950/40 text-red-400 shadow-lg shadow-red-500/50 animate-pulse'
              : isUrgent
              ? 'border-amber-400 bg-amber-950/40 text-amber-300 shadow-lg shadow-amber-400/50 animate-ping-slow'
              : 'border-slate-700 bg-slate-950/80 text-amber-300'
          }`}
        >
          <span className="font-mono text-3xl sm:text-4xl font-black tracking-tight">{seconds}s</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hitster</span>
        </div>

        <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          onClick={toggleTimer}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            isRunning
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold shadow-md shadow-amber-500/20'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>{getTranslation(language, 'pauseTimer')}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{getTranslation(language, 'startTimer')}</span>
            </>
          )}
        </button>

        <button
          onClick={resetTimer}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
          title={getTranslation(language, 'resetTimer')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
