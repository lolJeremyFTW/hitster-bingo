import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, UserPlus, Crown, Coins, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { Language, PlayerScore } from '../types/hitster';
import type { RoomPlayer, RoomStatus } from '../utils/useRoom';

interface ScoreboardProps {
  language: Language;
  onClose: () => void;
  /** Spelers die via de kamer binnenkwamen; dan vervalt handmatig toevoegen */
  roomPlayers?: RoomPlayer[];
  roomCode?: string | null;
  roomStatus?: RoomStatus;
  roomError?: string | null;
  /** Kaarten en munten per speler-id, uit de lopende klassieke partij */
  liveStats?: Record<string, { cards: number; tokens: number }>;
  /** Afgekruiste vakjes en bingo's per speler-id, in de bingo-modus */
  bingoStats?: Record<string, { marked: number; bingos: number }>;
  /** Bepaalt welke cijfers zinvol zijn om te tonen */
  mode?: 'classic' | 'bingo';
  myPlayerId?: string | null;
}

/**
 * Het scorebord vult zichzelf zodra er een kamer draait: wie de QR-code scant
 * en een naam kiest, verschijnt hier vanzelf. Handmatig namen invoeren kan
 * alleen nog zonder kamer, zodat je ook offline om de tafel kunt spelen.
 */
export const Scoreboard: React.FC<ScoreboardProps> = ({
  language,
  onClose,
  roomPlayers,
  roomCode,
  roomStatus = 'idle',
  roomError,
  liveStats,
  bingoStats,
  mode = 'classic',
  myPlayerId,
}) => {
  const isBingo = mode === 'bingo';
  const isNl = language === 'nl';
  const isLive = !!roomCode && (roomPlayers?.length ?? 0) > 0;

  const [manualPlayers, setManualPlayers] = useState<PlayerScore[]>(() => {
    const local = localStorage.getItem('hitster_scoreboard');
    if (local) {
      try { return JSON.parse(local); } catch { /* verse lijst */ }
    }
    return [];
  });
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    localStorage.setItem('hitster_scoreboard', JSON.stringify(manualPlayers));
  }, [manualPlayers]);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setManualPlayers(prev => [...prev, {
      playerId: `m_${Date.now()}`,
      playerName: newPlayerName.trim(),
      bingoCount: 0,
      tileCount: 0,
    }]);
    setNewPlayerName('');
  };

  // Klassiek rangschikt op kaarten (munten als tiebreak), bingo op bingo's
  // en dan op afgekruiste vakjes
  const ranked = isLive
    ? [...(roomPlayers ?? [])]
        .map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          cards: liveStats?.[p.id]?.cards ?? 0,
          tokens: liveStats?.[p.id]?.tokens ?? 0,
          marked: bingoStats?.[p.id]?.marked ?? 0,
          bingos: bingoStats?.[p.id]?.bingos ?? 0,
        }))
        .sort((a, b) =>
          isBingo
            ? b.bingos - a.bingos || b.marked - a.marked
            : b.cards - a.cards || b.tokens - a.tokens
        )
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-md w-full text-slate-100 shadow-2xl my-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h2 className="font-black text-xl text-amber-200">
              {isNl ? 'Scorebord' : 'Scoreboard'}
            </h2>
          </div>
          {roomCode && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${
              roomStatus === 'connected'
                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                : roomStatus === 'connecting'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}>
              {roomStatus === 'connecting'
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : roomStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              #{roomCode}
            </span>
          )}
        </div>

        {roomError && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed">
            {roomError}
          </div>
        )}

        {isLive ? (
          <>
            <p className="text-[11px] text-slate-400 mb-3">
              {isNl
                ? 'Spelers verschijnen hier vanzelf zodra ze de QR-code scannen en een naam kiezen.'
                : 'Players appear automatically once they scan the QR code and pick a name.'}
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {ranked.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                    p.id === myPlayerId
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 ${
                      i === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-100 truncate">{p.name}</span>
                    {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {p.id === myPlayerId && (
                      <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded shrink-0">
                        {isNl ? 'jij' : 'you'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isBingo ? (
                      <>
                        {p.bingos > 0 && (
                          <span className="flex items-center gap-1 text-amber-300 font-black">
                            <Trophy className="w-3.5 h-3.5" />{p.bingos}
                          </span>
                        )}
                        <span className="font-black text-slate-200">
                          {p.marked}{' '}
                          <span className="text-slate-500 font-normal">
                            {isNl
                              ? (p.marked === 1 ? 'vakje' : 'vakjes')
                              : (p.marked === 1 ? 'square' : 'squares')}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1 text-amber-300 font-black">
                          <Coins className="w-3.5 h-3.5" />{p.tokens}
                        </span>
                        <span className="font-black text-slate-200">
                          {p.cards}{' '}
                          <span className="text-slate-500 font-normal">
                            {isNl
                              ? (p.cards === 1 ? 'kaart' : 'kaarten')
                              : (p.cards === 1 ? 'card' : 'cards')}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-400 mb-3">
              {roomCode
                ? (isNl
                    ? 'Nog niemand meegedaan. Deel de QR-code zodat spelers kunnen joinen.'
                    : 'Nobody joined yet. Share the QR code so players can join.')
                : (isNl
                    ? 'Geen kamer actief. Start een spel om spelers automatisch te verzamelen, of houd hieronder handmatig bij.'
                    : 'No room active. Start a game to collect players automatically, or track manually below.')}
            </p>

            <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder={isNl ? 'Naam speler' : 'Player name'}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isNl ? 'Toevoegen' : 'Add'}
              </button>
            </form>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-2">
              {manualPlayers.map((p) => (
                <div key={p.playerId} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-bold text-slate-100 truncate">{p.playerName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setManualPlayers(prev => prev.map(x =>
                        x.playerId === p.playerId ? { ...x, bingoCount: x.bingoCount + 1 } : x))}
                      className="p-1.5 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black text-amber-300 w-5 text-center">{p.bingoCount}</span>
                    <button
                      onClick={() => setManualPlayers(prev => prev.filter(x => x.playerId !== p.playerId))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
        >
          {isNl ? 'Sluiten' : 'Close'}
        </button>
      </div>
    </div>
  );
};
