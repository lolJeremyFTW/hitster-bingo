import React, { useState } from 'react';
import { BookOpen, Disc, Coins, Trophy, Music, Hand } from 'lucide-react';
import type { GameMode, Language } from '../types/hitster';
import { getHitsterCategories } from '../data/hitsterCategories';

interface RulesModalProps {
  language: Language;
  onClose: () => void;
  gameMode?: GameMode;
}

type RulesTab = 'bingo' | 'classic';

/**
 * Spelregels van de twee modi. Bewust letterlijk gehouden aan het bordspel,
 * inclusief de kleurcategorieën per zijde en de token-regels.
 */
export const RulesModal: React.FC<RulesModalProps> = ({ language, onClose, gameMode }) => {
  const [tab, setTab] = useState<RulesTab>(gameMode === 'classic' ? 'classic' : 'bingo');
  const isNl = language === 'nl';

  const sideA = getHitsterCategories('sideA');
  const sideB = getHitsterCategories('sideB');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full text-slate-100 shadow-2xl relative my-auto animate-fade-in">
        <div className="flex items-center gap-2.5 mb-4 border-b border-slate-800 pb-3">
          <BookOpen className="w-6 h-6 text-amber-400" />
          <h2 className="font-black text-xl text-amber-200">
            {isNl ? 'Spelregels' : 'Game rules'}
          </h2>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('bingo')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
              tab === 'bingo' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            Hitster Bingo
          </button>
          <button
            onClick={() => setTab('classic')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
              tab === 'classic' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            {isNl ? 'Klassiek' : 'Classic'}
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[26rem] overflow-y-auto pr-1">
          {tab === 'bingo' ? (
            <>
              <Step icon={<Disc className="w-5 h-5 text-amber-400" />} title={isNl ? '1. Draai de discobal' : '1. Spin the disco ball'}>
                {isNl
                  ? 'De kleur waarop de bal stopt bepaalt wat je deze ronde moet raden.'
                  : 'The colour the ball lands on decides what to guess this round.'}
              </Step>

              <Step icon={<Music className="w-5 h-5 text-purple-400" />} title={isNl ? '2. Luister 25 seconden' : '2. Listen for 25 seconds'}>
                {isNl
                  ? 'Iedereen vult binnen die 25 seconden een antwoord in en zet het vast.'
                  : 'Everyone locks in an answer within those 25 seconds.'}
              </Step>

              <Step icon={<Trophy className="w-5 h-5 text-emerald-400" />} title={isNl ? '3. Goed? Kruis één vakje af' : '3. Correct? Cross one square'}>
                {isNl
                  ? 'Bij een goed antwoord kruis je precies één vakje af in de kleur van deze ronde. Een verkeerde kleur telt niet.'
                  : 'A correct answer lets you cross exactly one square of this round\'s colour. Wrong colour does not count.'}
              </Step>

              <Step icon={<Trophy className="w-5 h-5 text-yellow-400" />} title={isNl ? '4. Bingo' : '4. Bingo'}>
                {isNl
                  ? 'Een volle rij, kolom of diagonaal wint het spel.'
                  : 'A full row, column or diagonal wins.'}
              </Step>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-amber-300 mb-2">{isNl ? 'De vijf kleuren' : 'The five colours'}</div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left pb-1">{isNl ? 'Kleur' : 'Colour'}</th>
                      <th className="text-left pb-1">{isNl ? 'Zijde A' : 'Side A'}</th>
                      <th className="text-left pb-1">{isNl ? 'Zijde B' : 'Side B'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sideA.map((cat, i) => (
                      <tr key={cat.color} className="border-t border-slate-900">
                        <td className="py-1">
                          <span className={`inline-block w-3 h-3 rounded-full ${cat.dotClass}`} />
                        </td>
                        <td className="py-1 text-slate-300">{isNl ? cat.labelNl : cat.labelEn}</td>
                        <td className="py-1 text-slate-300">{isNl ? sideB[i].labelNl : sideB[i].labelEn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <Step icon={<Music className="w-5 h-5 text-purple-400" />} title={isNl ? '1. Speel het nummer' : '1. Play the song'}>
                {isNl
                  ? 'De speler die aan de beurt is hoort het nummer zonder titel, artiest of jaartal te zien.'
                  : 'The active player hears the song without seeing title, artist or year.'}
              </Step>

              <Step icon={<Hand className="w-5 h-5 text-cyan-400" />} title={isNl ? '2. Plaats in je tijdlijn' : '2. Place it in your timeline'}>
                {isNl
                  ? 'Zet de kaart op de plek waar hij volgens jou hoort: oudste links, nieuwste rechts. Goed geplaatst betekent kaart houden, fout betekent kaart weg.'
                  : 'Put the card where you think it belongs: oldest left, newest right. Correct means you keep it, wrong means you lose it.'}
              </Step>

              <Step icon={<Coins className="w-5 h-5 text-amber-400" />} title={isNl ? '3. Munt verdienen' : '3. Earn a token'}>
                {isNl
                  ? 'Noem je ook de juiste titel én artiest, dan verdien je een munt — zelfs als je de kaart verkeerd plaatst. Je kunt er maximaal 5 hebben.'
                  : 'Name the correct title and artist to earn a token, even if you place the card wrong. You can hold up to 5.'}
              </Step>

              <Step icon={<Hand className="w-5 h-5 text-red-400" />} title={isNl ? '4. Stelen: roep HITSTER' : '4. Steal: call HITSTER'}>
                {isNl
                  ? 'Denk je dat een ander fout plaatst? Roep HITSTER vóór het omdraaien en zet een munt op de plek waar jij denkt dat de kaart hoort. Klopt het, dan steel je de kaart. Zit je ernaast, dan ben je je munt kwijt. Per positie mag maar één munt liggen.'
                  : 'Think someone placed it wrong? Call HITSTER before the reveal and put a token where you think it belongs. If right, you steal the card. If wrong, you lose the token. Only one token per position.'}
              </Step>

              <Step icon={<Trophy className="w-5 h-5 text-yellow-400" />} title={isNl ? '5. Winnen' : '5. Winning'}>
                {isNl
                  ? 'De eerste speler met 10 correct geplaatste kaarten wint en is de Hitster.'
                  : 'The first player with 10 correctly placed cards wins and becomes the Hitster.'}
              </Step>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                {isNl
                  ? 'Tip: 3 munten inruilen laat je de bovenste kaart meteen goed plaatsen, zonder te raden.'
                  : 'Tip: trade 3 tokens to place the top card correctly without guessing.'}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
        >
          {isNl ? 'Sluiten' : 'Close'}
        </button>
      </div>
    </div>
  );
};

const Step: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
    <span className="flex-shrink-0 mt-0.5">{icon}</span>
    <div>
      <div className="font-bold text-slate-100">{title}</div>
      <p className="text-slate-400 mt-0.5">{children}</p>
    </div>
  </div>
);
