import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, QrCode, Play, Users, Copy, Check, Grid, Flame, Music } from 'lucide-react';
import type { GameMode, GridSize, Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';

interface RoomLobbyProps {
  language: Language;
  onStartGame: (mode: GameMode, gridSize: GridSize, roomCode: string) => void;
  onJoinRoom: (code: string) => void;
  activeRoomCode?: string;
  onOpenPlaylistStudio: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  language,
  onStartGame,
  onJoinRoom,
  activeRoomCode,
  onOpenPlaylistStudio
}) => {
  const [mode, setMode] = useState<GameMode>('sideA');
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const [roomCode] = useState(() => {
    if (activeRoomCode) return activeRoomCode;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  });

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&mode=${mode}&grid=${gridSize}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    onStartGame(mode, gridSize, roomCode);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onJoinRoom(inputCode.trim().toUpperCase());
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 mb-3">
          <Flame className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'tagline')}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-amber-100 tracking-tight">
          {getTranslation(language, 'appName')}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto">
          {language === 'nl'
            ? 'Speel Hitster Bingo rond het kampvuur met je fysieke Hitster kaarten! Iedereen krijgt z\'n eigen bingokaart op z\'n mobiel.'
            : 'Play Hitster Bingo around the campfire with your physical cards! Everyone gets their own unique bingo card on their phone.'}
        </p>

        <div className="mt-6 text-left">
          <label className="text-xs font-extrabold uppercase text-amber-400 tracking-wider block mb-2">
            1. Kies Spelmodus / Mode:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => setMode('sideA')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                mode === 'sideA'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-extrabold text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{getTranslation(language, 'modeSideA')}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'nl' ? 'Decennia, Meezingers & Genres (Toegankelijk)' : 'Decades, Sing-alongs & Genres'}
              </p>
            </button>

            <button
              onClick={() => setMode('sideB')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                mode === 'sideB'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-extrabold text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{getTranslation(language, 'modeSideB')}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'nl' ? 'Exact decennium, Schrikkeljaar & Uitdagingen' : 'Exact Decade & Expert Challenges'}
              </p>
            </button>

            <button
              onClick={() => setMode('campfire')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                mode === 'campfire'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-extrabold text-sm flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>{getTranslation(language, 'modeCampfire')}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'nl' ? 'Inclusief Kampvuur Koor & Proost opdrachten!' : 'Includes Campfire Chorus & Cheers tasks!'}
              </p>
            </button>

            <button
              onClick={() => {
                setMode('custom');
                onOpenPlaylistStudio();
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                mode === 'custom'
                  ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md shadow-purple-500/20'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-extrabold text-sm flex items-center gap-1.5">
                <Music className="w-4 h-4 text-purple-400" />
                <span>{getTranslation(language, 'modeCustom')}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'nl' ? 'Maak/beheer je eigen afspeellijst' : 'Create & manage custom playlists'}
              </p>
            </button>
          </div>
        </div>

        <div className="mt-5 text-left">
          <label className="text-xs font-extrabold uppercase text-amber-400 tracking-wider block mb-2">
            2. Kies Grid Formaat / Board Size:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([3, 4, 5] as GridSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => setGridSize(sz)}
                className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  gridSize === sz
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{sz}x{sz}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCreate}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{getTranslation(language, 'createGame')}</span>
          </button>

          <button
            onClick={() => setShowQRModal(true)}
            className="w-full sm:w-auto p-3 rounded-2xl bg-slate-950 border border-amber-500/40 text-amber-300 hover:bg-slate-850 flex items-center justify-center gap-2 font-bold text-xs"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>QR Code</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl text-center">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'joinGame')}</span>
        </h3>
        <form onSubmit={handleJoin} className="flex gap-2 max-w-md mx-auto">
          <input
            type="text"
            maxLength={4}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder={getTranslation(language, 'enterCode')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono font-bold text-base uppercase text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!inputCode.trim()}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 transition-all"
          >
            {getTranslation(language, 'join')}
          </button>
        </form>
      </div>

      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full text-center text-slate-100 shadow-2xl relative animate-fade-in">
            <h3 className="font-black text-lg text-amber-200 mb-1">
              {getTranslation(language, 'scanQRToJoin')}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Kamer Code / Room Code: <span className="font-mono font-bold text-amber-300">#{roomCode}</span>
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              <QRCodeSVG value={roomUrl} size={180} level="M" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center justify-center gap-1.5 hover:bg-slate-700"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? getTranslation(language, 'copiedLink') : getTranslation(language, 'copyRoomLink')}</span>
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
              >
                {getTranslation(language, 'close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
