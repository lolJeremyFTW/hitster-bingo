import React from 'react';
import { Coins, Crown, Plus } from 'lucide-react';
import type { Language } from '../types/hitster';
import type { ClassicPlayer, TimelineCard } from '../utils/classicGame';
import { CARDS_TO_WIN } from '../utils/classicGame';

interface ClassicTimelineProps {
  player: ClassicPlayer;
  language: Language;
  /** Toont de invoegplekken waar de kaart geplaatst kan worden */
  canPlace?: boolean;
  onPlace?: (position: number) => void;
  /** Posities waar al een steal-munt ligt, met de naam van de inzetter */
  stealMarkers?: { position: number; label: string }[];
  /** Na de onthulling: welke posities waren goed */
  correctPositions?: number[];
  /** De kaart die deze beurt geplaatst wordt, nog zonder jaartal */
  pendingCard?: { title: string; artist: string } | null;
  placedPosition?: number | null;
  isRevealed?: boolean;
}

/**
 * De tijdlijn van één speler: oudste links, nieuwste rechts.
 *
 * Tien kaarten winnen het spel, dus die passen in twee rijen van vijf. Op een
 * horizontaal gehouden telefoon blijft dat leesbaar zonder te scrollen.
 */
export const ClassicTimeline: React.FC<ClassicTimelineProps> = ({
  player,
  language,
  canPlace = false,
  onPlace,
  stealMarkers = [],
  correctPositions = [],
  pendingCard,
  placedPosition,
  isRevealed = false,
}) => {
  const isNl = language === 'nl';

  // Twee rijen van vijf; de tweede rij verschijnt pas als hij nodig is
  const rows: TimelineCard[][] = [
    player.timeline.slice(0, 5),
    player.timeline.slice(5, 10),
  ];

  const renderSlot = (position: number) => {
    const marker = stealMarkers.find(s => s.position === position);
    const isCorrect = isRevealed && correctPositions.includes(position);
    const isChosen = placedPosition === position;
    // Posities voorbij het einde bestaan alleen als opvulling, niet als keuze
    const inRange = position <= player.timeline.length;
    const canPlaceHere = canPlace && inRange;

    // Vaste breedte, altijd. Een smallere of ontbrekende plek laat de kaarten
    // ernaast uitrekken, waardoor rij 1 en rij 2 niet meer even breed zijn.
    return (
      <button
        key={`slot-${position}`}
        onClick={() => canPlaceHere && onPlace?.(position)}
        disabled={!canPlaceHere}
        aria-hidden={!canPlaceHere && !marker && !isChosen && !isCorrect}
        className={`shrink-0 h-full w-7 sm:w-9 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-0.5 ${
          canPlaceHere ? 'cursor-pointer' : ''
        } ${
          isChosen
            ? 'border-amber-400 bg-amber-500/25'
            : isCorrect
            ? 'border-green-400 bg-green-500/20'
            : marker
            ? 'border-red-400 bg-red-500/20'
            : canPlaceHere
            ? 'border-slate-600 hover:border-amber-400 hover:bg-amber-500/15'
            : 'border-transparent'
        }`}
        title={marker ? `${marker.label} claimt deze plek` : undefined}
      >
        {marker ? (
          <Coins className="w-3.5 h-3.5 text-red-300" />
        ) : canPlaceHere ? (
          <Plus className="w-3.5 h-3.5 text-slate-400" />
        ) : null}
        {marker && (
          <span className="text-[8px] font-bold text-red-200 leading-none px-0.5 truncate max-w-full">
            {marker.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* Naam en score staan al in de spelersstrip erboven; op een laag scherm
          is die herhaling verspilde ruimte */}
      <div className="flex [@media(max-height:480px)]:hidden items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-sm text-slate-100 truncate">{player.name}</span>
          {player.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="text-[10px] font-bold text-slate-400 shrink-0">
            {player.timeline.length}/{CARDS_TO_WIN}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-black text-amber-300">{player.tokens}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map((row, rowIdx) => {
          // Rij 2 alleen tonen als er kaarten zijn, of als er geplaatst mag worden
          if (rowIdx === 1 && row.length === 0 && player.timeline.length < 5) return null;
          const offset = rowIdx * 5;

          // Op een liggende telefoon is de hóógte krap, niet de breedte —
          // dus sturen op max-height in plaats van op sm:/lg:
          return (
            // Grid in plaats van flex: bij flex verdeelde de browser de rest-
            // ruimte per rij nét anders, waardoor rij 2 bredere kaarten kreeg.
            // Met een vast kolompatroon zijn alle 1fr-kolommen exact gelijk.
            <div
              key={rowIdx}
              className="grid items-stretch gap-0.5 h-20 lg:h-24 [@media(max-height:480px)]:h-[3.25rem]"
              style={{ gridTemplateColumns: 'repeat(5, auto minmax(0, 1fr)) auto' }}
            >
              {/* Altijd vijf even brede cellen, ook als de rij half vol is —
                  anders rekt één kaart uit over de hele breedte */}
              {Array.from({ length: 5 }, (_, i) => {
                const card = row[i];
                const position = offset + i;

                if (!card) {
                  // Ook lege cellen krijgen een plek ervoor: alleen dan houden
                  // beide rijen precies evenveel ruimte over voor de kaarten
                  return (
                    <React.Fragment key={`empty-${position}`}>
                      {renderSlot(position)}
                      <div className="min-w-0 rounded-lg border border-dashed border-slate-800/60" />
                    </React.Fragment>
                  );
                }

                return (
                  // Positie meenemen: een track kan in theorie twee keer op een
                  // tijdlijn belanden en dan botsen de keys
                  <React.Fragment key={`${card.trackId}-${position}`}>
                    {renderSlot(position)}
                    {/* overflow-hidden + break-words: zonder dat duwt een lange
                        titel zijn cel breder dan de andere en lopen de rijen
                        uit de pas */}
                    <div className="min-w-0 overflow-hidden rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-1 flex flex-col items-center justify-center text-center shadow">
                      <div className="font-black text-sm sm:text-base text-amber-300 leading-none">
                        {card.year}
                      </div>
                      <div className="w-full text-[9px] font-bold text-slate-200 leading-tight line-clamp-2 break-words mt-0.5">
                        {card.title}
                      </div>
                      <div className="w-full text-[8px] text-slate-400 leading-tight line-clamp-1 break-words">
                        {card.artist}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {/* Sluitende plek rechts; beide rijen hebben hem, anders scheelt
                  het weer breedte tussen de rijen */}
              {renderSlot(offset + 5)}
            </div>
          );
        })}

        {player.timeline.length === 0 && (
          <p className="text-[11px] text-slate-500 italic px-1">
            {isNl
              ? 'Nog geen kaarten. De eerste kaart is altijd goed.'
              : 'No cards yet. The first card is always correct.'}
          </p>
        )}
      </div>

      {pendingCard && !isRevealed && (
        <div className="mt-2 text-[11px] text-slate-400 px-0.5">
          {isNl ? 'Te plaatsen kaart: ' : 'Card to place: '}
          <span className="font-bold text-slate-200">???</span>
        </div>
      )}
    </div>
  );
};
