import React, { useState, useCallback } from 'react';
import { Coins, Eye, Users, Play, Pause, RotateCw, Trophy, Hand, Check, X } from 'lucide-react';
import type { CustomTrack, Language } from '../types/hitster';
import { ClassicTimeline } from './ClassicTimeline';
import { spotifyPlayer } from '../utils/spotifyPlayer';
import { soundEffects } from '../utils/soundEffects';
import {
  type ClassicGameState,
  type ResolveOutcome,
  CARDS_TO_WIN,
  canSteal,
  correctPositions,
  drawTrack,
  nextTurn,
  resolveTurn,
  toTimelineCard,
} from '../utils/classicGame';

interface ClassicGameProps {
  state: ClassicGameState;
  setState: (updater: (prev: ClassicGameState) => ClassicGameState) => void;
  tracks: CustomTrack[];
  language: Language;
  /** Wie kijkt er op dit toestel mee; bepaalt wat je mag doen */
  localPlayerId: string;
  snippetSeconds?: number;
}

/**
 * Het klassieke Hitster-spel: nummer horen, kaart blind in je tijdlijn zetten,
 * tegenstanders mogen HITSTER roepen om te stelen, daarna de onthulling.
 *
 * Bedoeld voor een horizontaal gehouden telefoon: de tijdlijn van de actieve
 * speler krijgt de ruimte, de rest staat als strip bovenin.
 */
export const ClassicGame: React.FC<ClassicGameProps> = ({
  state,
  setState,
  tracks,
  language,
  localPlayerId,
  snippetSeconds = 25,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(snippetSeconds);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ResolveOutcome['summary'] | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const isNl = language === 'nl';
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = active?.id === localPlayerId;
  const me = state.players.find(p => p.id === localPlayerId);
  const viewed = state.players.find(p => p.id === viewedPlayerId) ?? active;
  const isViewingActive = viewed?.id === active?.id;

  const card = state.currentTrack ? toTimelineCard(state.currentTrack) : null;
  const correct = card && active ? correctPositions(active.timeline, card.year) : [];

  React.useEffect(() => {
    spotifyPlayer.setEvents({
      onStatus: (s, detail) => {
        if (s === 'scope-error' || s === 'no-premium' || s === 'error') setPlayerError(detail ?? null);
        else setPlayerError(null);
      },
      onTick: setSecondsLeft,
      onSnippetEnd: () => { setIsPlaying(false); setSecondsLeft(snippetSeconds); },
    });
  }, [snippetSeconds]);

  const handleDraw = useCallback(() => {
    const track = drawTrack(tracks, state.usedTrackIds);
    if (!track) return;
    setState(prev => ({ ...prev, currentTrack: track, phase: 'listening', placedPosition: null, steals: [] }));
    setOutcome(null);
    setViewedPlayerId(null);
    soundEffects.playSpinSelected();
  }, [tracks, state.usedTrackIds, setState]);

  const handlePlay = useCallback(async () => {
    if (!state.currentTrack?.spotifyUri) return;
    if (isPlaying) { spotifyPlayer.pause(); setIsPlaying(false); return; }
    setIsPlaying(true);
    setSecondsLeft(snippetSeconds);
    await spotifyPlayer.playSnippet(state.currentTrack.spotifyUri, snippetSeconds, 0);
  }, [state.currentTrack, isPlaying, snippetSeconds]);

  const handlePlace = (position: number) => {
    setState(prev => ({ ...prev, placedPosition: position, phase: 'placed' }));
    soundEffects.playTilePop(true);
  };

  const handleSteal = (position: number) => {
    if (!canSteal(state, localPlayerId, position)) return;
    setState(prev => ({ ...prev, steals: [...prev.steals, { playerId: localPlayerId, position }] }));
    soundEffects.playTilePop(true);
  };

  const handleReveal = () => {
    spotifyPlayer.pause();
    setIsPlaying(false);
    const result = resolveTurn(state);
    setState(() => result.state);
    setOutcome(result.summary);
    if (result.summary.placementCorrect) soundEffects.playBingoVictory();
  };

  const handleNext = () => {
    setState(prev => nextTurn(prev));
    setOutcome(null);
    setViewedPlayerId(null);
    setSecondsLeft(snippetSeconds);
  };

  const winner = state.players.find(p => p.id === state.winnerId);

  if (winner) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-orange-500 text-slate-950 text-center shadow-2xl">
        <Trophy className="w-12 h-12 mx-auto mb-2" />
        <h2 className="text-2xl font-black">{winner.name} {isNl ? 'is de Hitster!' : 'is the Hitster!'}</h2>
        <p className="font-bold mt-1">
          {winner.timeline.length} {isNl ? 'kaarten op de juiste plek' : 'cards placed correctly'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Spelersstrip: munten en kaarten van iedereen, klikbaar om te bekijken */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {state.players.map(p => {
          const isActive = p.id === active?.id;
          const isViewed = p.id === viewed?.id;
          return (
            <button
              key={p.id}
              onClick={() => setViewedPlayerId(p.id)}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                isViewed
                  ? 'bg-slate-800 border-amber-400'
                  : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
              } ${isActive ? 'ring-2 ring-amber-500/60' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-100 max-w-[7rem] truncate">{p.name}</span>
                {p.id === localPlayerId && (
                  <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded">
                    {isNl ? 'jij' : 'you'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black text-amber-300 flex items-center gap-0.5">
                  <Coins className="w-3 h-3" />{p.tokens}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {p.timeline.length}/{CARDS_TO_WIN}
                </span>
                {isActive && (
                  <span className="text-[9px] font-black text-amber-400 uppercase">
                    {isNl ? 'beurt' : 'turn'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {playerError && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200">
          {playerError}
        </div>
      )}

      {/* Speler en fragment */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-700">
        {!state.currentTrack ? (
          <button
            onClick={handleDraw}
            disabled={!isMyTurn}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
          >
            <RotateCw className="w-4 h-4" />
            {isMyTurn
              ? (isNl ? 'Trek een kaart' : 'Draw a card')
              : (isNl ? `${active?.name} is aan de beurt` : `${active?.name}'s turn`)}
          </button>
        ) : (
          <>
            <button
              onClick={handlePlay}
              disabled={!state.currentTrack.spotifyUri}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs uppercase flex items-center gap-1.5"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {isPlaying ? `${secondsLeft}s` : (isNl ? `Speel ${snippetSeconds}s` : `Play ${snippetSeconds}s`)}
            </button>

            {state.phase !== 'revealed' && isMyTurn && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.claimedTitleArtist}
                  onChange={e => setState(prev => ({ ...prev, claimedTitleArtist: e.target.checked }))}
                  className="accent-amber-500"
                />
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{isNl ? 'Titel én artiest geraden' : 'Named title and artist'}</span>
              </label>
            )}

            {state.phase === 'placed' && (
              <button
                onClick={handleReveal}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                {isNl ? 'Draai de kaart om' : 'Flip the card'}
              </button>
            )}

            {state.phase === 'revealed' && (
              <button
                onClick={handleNext}
                className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-100 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <RotateCw className="w-4 h-4" />
                {isNl ? 'Volgende beurt' : 'Next turn'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Uitslag van de beurt */}
      {outcome && card && (
        <div className={`p-3 rounded-2xl border text-xs font-bold ${
          outcome.placementCorrect
            ? 'bg-green-500/15 border-green-500/50 text-green-200'
            : 'bg-red-500/15 border-red-500/40 text-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {outcome.placementCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span className="text-sm">
              {card.title} — {card.artist} ({card.year})
            </span>
          </div>
          <p>
            {outcome.placementCorrect
              ? (isNl ? `${active?.name} plaatste de kaart goed en houdt hem.` : `${active?.name} placed it correctly.`)
              : outcome.successfulStealerId
              ? (isNl
                  ? `Fout geplaatst! ${state.players.find(p => p.id === outcome.successfulStealerId)?.name} steelt de kaart.`
                  : `Wrong! ${state.players.find(p => p.id === outcome.successfulStealerId)?.name} steals it.`)
              : (isNl ? 'Fout geplaatst. De kaart gaat weg.' : 'Wrong placement. The card is discarded.')}
          </p>
          {outcome.tokenEarnedBy && (
            <p className="mt-1 text-amber-300 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              {isNl ? 'Munt verdiend voor titel én artiest.' : 'Token earned for title and artist.'}
            </p>
          )}
          {outcome.failedStealers.length > 0 && (
            <p className="mt-1 text-slate-400">
              {isNl ? 'Munt kwijt: ' : 'Lost a token: '}
              {outcome.failedStealers.map(id => state.players.find(p => p.id === id)?.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Tijdlijn van de bekeken speler */}
      <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase font-black tracking-wider text-slate-400">
          <Users className="w-3.5 h-3.5" />
          <span>
            {isViewingActive
              ? (isNl ? 'Tijdlijn van de speler aan de beurt' : "Active player's timeline")
              : (isNl ? `Je bekijkt de tijdlijn van ${viewed?.name}` : `Viewing ${viewed?.name}'s timeline`)}
          </span>
        </div>

        {viewed && (
          <ClassicTimeline
            player={viewed}
            language={language}
            canPlace={isViewingActive && isMyTurn && state.phase === 'listening' && !!state.currentTrack}
            onPlace={handlePlace}
            stealMarkers={isViewingActive ? state.steals.map(s => ({
              position: s.position,
              label: state.players.find(p => p.id === s.playerId)?.name.slice(0, 6) ?? '?',
            })) : []}
            correctPositions={state.phase === 'revealed' && isViewingActive ? correct : []}
            placedPosition={isViewingActive ? state.placedPosition : null}
            isRevealed={state.phase === 'revealed'}
            pendingCard={state.currentTrack && isViewingActive
              ? { title: state.currentTrack.title, artist: state.currentTrack.artist }
              : null}
          />
        )}
      </div>

      {/* Stelen: alleen voor wie niet aan de beurt is en munten heeft */}
      {state.phase === 'placed' && !isMyTurn && me && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-black text-red-200">
            <Hand className="w-4 h-4" />
            <span>{isNl ? 'HITSTER roepen?' : 'Call HITSTER?'}</span>
          </div>
          <p className="text-[11px] text-red-200/80 mb-2">
            {me.tokens < 1
              ? (isNl ? 'Je hebt geen munten om in te zetten.' : 'You have no tokens to spend.')
              : state.steals.some(s => s.playerId === localPlayerId)
              ? (isNl ? 'Je hebt al een munt ingezet deze beurt.' : 'You already placed a token this turn.')
              : (isNl
                  ? `Denk je dat ${active?.name} fout plaatst? Kies hierboven in de tijdlijn de plek waar de kaart volgens jou hoort. Klopt het, dan steel je de kaart.`
                  : `Think ${active?.name} is wrong? Pick the correct spot in the timeline above to steal the card.`)}
          </p>
          {me.tokens >= 1 && !state.steals.some(s => s.playerId === localPlayerId) && viewed && isViewingActive && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: (active?.timeline.length ?? 0) + 1 }, (_, i) => i)
                .filter(pos => !state.steals.some(s => s.position === pos))
                .map(pos => (
                  <button
                    key={pos}
                    onClick={() => handleSteal(pos)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Coins className="w-3 h-3" />
                    {isNl ? `Plek ${pos + 1}` : `Slot ${pos + 1}`}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
