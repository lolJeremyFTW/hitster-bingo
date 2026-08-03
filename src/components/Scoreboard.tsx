import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, UserPlus, Flame } from 'lucide-react';
import type { Language, PlayerScore } from '../types/hitster';
import { getTranslation } from '../utils/translations';

interface ScoreboardProps {
  language: Language;
  onClose: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ language, onClose }) => {
  const [players, setPlayers] = useState<PlayerScore[]>(() => {
    const local = localStorage.getItem('hitster_scoreboard');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // Fallback
      }
    }
    return [
      { playerId: 'p1', playerName: 'Speler 1', bingoCount: 0, tileCount: 0 },
      { playerId: 'p2', playerName: 'Speler 2', bingoCount: 0, tileCount: 0 },
    ];
  });

  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    localStorage.setItem('hitster_scoreboard', JSON.stringify(players));
  }, [players]);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setPlayers(prev => [
      ...prev,
      {
        playerId: `player_${Date.now()}`,
        playerName: newPlayerName.trim(),
        bingoCount: 0,
        tileCount: 0
      }
    ]);
    setNewPlayerName('');
  };

  const handleIncrementBingo = (id: string) => {
    setPlayers(prev =>
      prev.map(p => (p.playerId === id ? { ...p, bingoCount: p.bingoCount + 1 } : p))
    );
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.playerId !== id));
  };

  const handleResetScores = () => {
    setPlayers(prev => prev.map(p => ({ ...p, bingoCount: 0, tileCount: 0 })));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-md w-full text-slate-100 shadow-2xl relative my-auto animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-black text-lg text-amber-200">
              {getTranslation(language, 'scoreboardTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-bold p-2 bg-slate-800 rounded-lg"
          >
            {getTranslation(language, 'close')}
          </button>
        </div>

        <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Naam Speler / Team"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!newPlayerName.trim()}
            className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            <span>Toevoegen</span>
          </button>
        </form>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
          {players.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-200">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>{p.playerName}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-amber-300 text-sm">
                  {p.bingoCount} Bingo{p.bingoCount !== 1 ? 's' : ''}
                </span>

                <button
                  onClick={() => handleIncrementBingo(p.playerId)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>1</span>
                </button>

                <button
                  onClick={() => handleRemovePlayer(p.playerId)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-between">
          <button
            onClick={handleResetScores}
            className="text-xs text-slate-400 hover:text-red-400 font-bold transition-colors"
          >
            {getTranslation(language, 'resetScores')}
          </button>
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
          >
            {getTranslation(language, 'close')}
          </button>
        </div>
      </div>
    </div>
  );
};
