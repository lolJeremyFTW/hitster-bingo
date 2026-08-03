import type { HitsterCategory, HitsterColor, GameMode } from '../types/hitster';

/**
 * De vijf categorieën van Hitster Bingo, zoals op de discobal en de scorekaart.
 *
 * De discobal wijst per ronde één kleur aan; die kleur bepaalt wat je moet
 * raden. Bij een goed antwoord kruis je precies één vakje van díe kleur aan.
 * Zijde A is voor beginners, zijde B voor gevorderden.
 */

export const SIDE_A: HitsterCategory[] = [
  {
    color: 'green',
    labelNl: 'Solo of groep?',
    labelEn: 'Solo or group?',
    hintNl: 'Is dit een solo-artiest of een groep/band?',
    hintEn: 'Is this a solo artist or a group?',
    answerType: 'soloGroup',
    tileClass: 'from-emerald-500 to-green-600',
    dotClass: 'bg-emerald-500',
  },
  {
    color: 'pink',
    labelNl: 'Vóór of ná 2000?',
    labelEn: 'Before or after 2000?',
    hintNl: 'Is het nummer uitgebracht vóór of vanaf het jaar 2000?',
    hintEn: 'Was the song released before or from the year 2000?',
    answerType: 'beforeAfter',
    pivotYear: 2000,
    tileClass: 'from-pink-500 to-rose-600',
    dotClass: 'bg-pink-500',
  },
  {
    color: 'yellow',
    labelNl: 'Jaartal (±4 jaar)',
    labelEn: 'Release year (±4 years)',
    hintNl: 'Vul het releasejaar in. Zit je er maximaal 4 jaar naast, dan is het goed.',
    hintEn: 'Enter the release year. Within 4 years counts as correct.',
    answerType: 'year',
    tolerance: 4,
    tileClass: 'from-amber-400 to-yellow-500',
    dotClass: 'bg-amber-400',
  },
  {
    color: 'purple',
    labelNl: 'Decennium',
    labelEn: 'Decade',
    hintNl: 'In welk decennium kwam het nummer uit? (bijv. 1980 voor de jaren 80)',
    hintEn: 'Which decade was it released in? (e.g. 1980 for the 80s)',
    answerType: 'decade',
    tileClass: 'from-purple-500 to-violet-600',
    dotClass: 'bg-purple-500',
  },
  {
    color: 'blue',
    labelNl: 'Jaartal (±2 jaar)',
    labelEn: 'Release year (±2 years)',
    hintNl: 'Vul het releasejaar in. Maximaal 2 jaar ernaast is nog goed.',
    hintEn: 'Enter the release year. Within 2 years counts as correct.',
    answerType: 'year',
    tolerance: 2,
    tileClass: 'from-blue-500 to-indigo-600',
    dotClass: 'bg-blue-500',
  },
];

export const SIDE_B: HitsterCategory[] = [
  {
    color: 'green',
    labelNl: 'Titel van het nummer',
    labelEn: 'Song title',
    hintNl: 'Hoe heet dit nummer?',
    hintEn: 'What is this song called?',
    answerType: 'title',
    tileClass: 'from-emerald-500 to-green-600',
    dotClass: 'bg-emerald-500',
  },
  {
    color: 'pink',
    labelNl: 'Exact jaartal',
    labelEn: 'Exact release year',
    hintNl: 'Vul het exacte releasejaar in. Alleen precies goed telt.',
    hintEn: 'Enter the exact release year. Only exact counts.',
    answerType: 'year',
    tolerance: 0,
    tileClass: 'from-pink-500 to-rose-600',
    dotClass: 'bg-pink-500',
  },
  {
    color: 'yellow',
    labelNl: 'Artiest of groep',
    labelEn: 'Artist or group',
    hintNl: 'Wie voert dit nummer uit?',
    hintEn: 'Who performs this song?',
    answerType: 'artist',
    tileClass: 'from-amber-400 to-yellow-500',
    dotClass: 'bg-amber-400',
  },
  {
    color: 'purple',
    labelNl: 'Decennium',
    labelEn: 'Decade',
    hintNl: 'In welk decennium kwam het nummer uit? (bijv. 1980 voor de jaren 80)',
    hintEn: 'Which decade was it released in? (e.g. 1980 for the 80s)',
    answerType: 'decade',
    tileClass: 'from-purple-500 to-violet-600',
    dotClass: 'bg-purple-500',
  },
  {
    color: 'blue',
    labelNl: 'Jaartal (±3 jaar)',
    labelEn: 'Release year (±3 years)',
    hintNl: 'Vul het releasejaar in. Maximaal 3 jaar ernaast is nog goed.',
    hintEn: 'Enter the release year. Within 3 years counts as correct.',
    answerType: 'year',
    tolerance: 3,
    tileClass: 'from-blue-500 to-indigo-600',
    dotClass: 'bg-blue-500',
  },
];

export const HITSTER_COLORS: HitsterColor[] = ['green', 'pink', 'yellow', 'purple', 'blue'];

/** Zijde B is de expertvariant; alle andere modi spelen zijde A. */
export function getHitsterCategories(mode: GameMode): HitsterCategory[] {
  return mode === 'sideB' ? SIDE_B : SIDE_A;
}

export function getCategoryByColor(mode: GameMode, color: HitsterColor): HitsterCategory {
  const set = getHitsterCategories(mode);
  return set.find(c => c.color === color) ?? set[0];
}
