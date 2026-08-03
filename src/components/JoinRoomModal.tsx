import React, { useState } from 'react';
import { Users, Loader2, AlertTriangle, LogIn } from 'lucide-react';
import type { Language } from '../types/hitster';
import type { RoomStatus } from '../utils/useRoom';
import { DEFAULT_START_TOKENS } from '../utils/classicGame';

interface JoinRoomModalProps {
  roomCode: string;
  language: Language;
  status: RoomStatus;
  error: string | null;
  onJoin: (name: string, startTokens?: number) => void;
  onCancel: () => void;
  /** De host opent de kamer in plaats van erin te stappen */
  isHost?: boolean;
  /** Toont de muntinstelling; alleen zinvol in de klassieke modus */
  showTokenSetting?: boolean;
}

/**
 * Verschijnt zodra iemand via de QR-code of een kamerlink binnenkomt.
 * De naam die hier wordt gekozen belandt in de spelerslijst van de kamer en
 * daarmee automatisch op het scorebord van iedereen.
 */
export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  roomCode,
  language,
  status,
  error,
  onJoin,
  onCancel,
  isHost = false,
  showTokenSetting = false,
}) => {
  // Naam onthouden, zodat je hem niet elke partij opnieuw hoeft te typen
  const [name, setName] = useState(() => localStorage.getItem('hitster_player_name') ?? '');
  const [startTokens, setStartTokens] = useState(DEFAULT_START_TOKENS);
  const isNl = language === 'nl';
  const busy = status === 'connecting';

  const submit = () => {
    const schoon = name.trim();
    if (schoon.length < 2) return;
    localStorage.setItem('hitster_player_name', schoon);
    onJoin(schoon, startTokens);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
        <div className="flex items-center gap-2.5 mb-1">
          <Users className="w-6 h-6 text-amber-400" />
          <h2 className="font-black text-xl text-amber-200">
            {isHost
              ? (isNl ? 'Spel starten' : 'Start game')
              : (isNl ? 'Meedoen' : 'Join game')}
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {isHost
            ? (isNl ? 'Je opent kamer ' : 'Opening room ')
            : (isNl ? 'Je doet mee aan kamer ' : 'Joining room ')}
          <span className="font-mono font-bold text-amber-300">#{roomCode}</span>
        </p>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            {isNl ? 'Kies je naam' : 'Choose your name'}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder={isNl ? 'bijv. Jeremy' : 'e.g. Jeremy'}
            disabled={busy}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-sm text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {isNl
              ? 'Deze naam zien de andere spelers op het scorebord.'
              : 'Other players see this name on the scoreboard.'}
          </p>

          {isHost && showTokenSetting && (
            <div className="mt-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                {isNl ? 'Munten om mee te starten' : 'Starting tokens'}
              </label>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStartTokens(n)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      startTokens === n
                        ? 'bg-amber-500 border-amber-400 text-slate-950'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {isNl
                  ? 'Met munten kun je HITSTER roepen en een kaart stelen. Iedereen begint met evenveel.'
                  : 'Tokens let you call HITSTER and steal a card. Everyone starts with the same amount.'}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-200 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase disabled:opacity-50"
            >
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {busy
                ? (isNl ? 'Verbinden…' : 'Connecting…')
                : isHost
                  ? (isNl ? 'Start spel' : 'Start game')
                  : (isNl ? 'Meedoen' : 'Join')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
