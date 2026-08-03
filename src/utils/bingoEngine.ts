import type { BingoCategory, BingoTile, CustomTrack, GameMode, GridSize, HitsterColor, Language } from '../types/hitster';
import { CAMPFIRE_EXTRA_CATEGORIES, SIDE_A_CATEGORIES, SIDE_B_CATEGORIES } from '../data/categories';
import { getHitsterCategories } from '../data/hitsterCategories';

// Simple PRNG (Linear Congruential Generator) for reproducible seeded card generation
function pseudoRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function generateRoomSeed(roomCode: string): number {
  let hash = 0;
  for (let i = 0; i < roomCode.length; i++) {
    hash = roomCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) + 12345;
}

/**
 * Smart Category Generator for Custom Playlists:
 * Analyzes the track years and attributes in the custom playlist
 * to ensure ZERO impossible or unreachable tiles on Bingo cards!
 */
export function generateCustomPlaylistCategories(tracks: CustomTrack[]): BingoCategory[] {
  if (!tracks || tracks.length === 0) {
    return [...SIDE_A_CATEGORIES, ...SIDE_B_CATEGORIES];
  }

  // 1. Analyze Decades present in custom playlist
  const decadesSet = new Set<number>();
  let hasYears = false;
  let minYear = 2030;
  let maxYear = 1900;

  tracks.forEach(t => {
    if (t.year) {
      hasYears = true;
      const decade = Math.floor(t.year / 10) * 10;
      decadesSet.add(decade);
      if (t.year < minYear) minYear = t.year;
      if (t.year > maxYear) maxYear = t.year;
    }
  });

  const categories: BingoCategory[] = [];

  // Add Decade categories ONLY for decades that actually exist in the custom playlist!
  decadesSet.forEach(d => {
    const decadeShort = d.toString().slice(2);
    categories.push({
      id: `custom_cat_${d}`,
      titleNl: `Jaren ${decadeShort} (${d}s)`,
      titleEn: `${d}s Hit`,
      descNl: `Nummer is uitgebracht in de jaren ${decadeShort} (${d}-${d + 9}).`,
      descEn: `Song released between ${d} and ${d + 9}.`,
      iconName: 'Disc',
      color: 'from-purple-500 to-pink-600',
      tags: ['custom_decade', `${d}s`]
    });
  });

  // Year Range Categories based on min/max
  if (hasYears && maxYear - minYear >= 10) {
    const midYear = Math.floor((minYear + maxYear) / 2);
    categories.push({
      id: `custom_before_${midYear}`,
      titleNl: `Vóór ${midYear}`,
      titleEn: `Before ${midYear}`,
      descNl: `Uitgebracht voor het jaar ${midYear}.`,
      descEn: `Released before the year ${midYear}.`,
      iconName: 'History',
      color: 'from-amber-600 to-orange-700',
      tags: ['custom_year_range']
    });

    categories.push({
      id: `custom_after_${midYear}`,
      titleNl: `Na ${midYear}`,
      titleEn: `After ${midYear}`,
      descNl: `Uitgebracht in of na het jaar ${midYear}.`,
      descEn: `Released in or after the year ${midYear}.`,
      iconName: 'Forward',
      color: 'from-indigo-500 to-purple-600',
      tags: ['custom_year_range']
    });
  }

  // Universal Attribute Categories (Always valid for any playlist)
  const universalTraits: BingoCategory[] = [
    {
      id: 'custom_exact_year',
      titleNl: 'Exact Jaartal Geraden!',
      titleEn: 'Exact Year Guessed!',
      descNl: 'Je hebt het exacte uitbrachtjaar 100% goed geraden!',
      descEn: 'You guessed the exact release year correctly!',
      iconName: 'Award',
      color: 'from-yellow-500 to-amber-600',
      tags: ['custom_trait']
    },
    {
      id: 'custom_within_2',
      titleNl: 'Binnen 2 Jaar Geraden',
      titleEn: 'Guessed Within 2 Years',
      descNl: 'Jouw jaartal gok zat er maximaal 2 jaar naast.',
      descEn: 'Your year guess was within 2 years of release.',
      iconName: 'Target',
      color: 'from-amber-500 to-yellow-600',
      tags: ['custom_trait']
    },
    {
      id: 'custom_singalong',
      titleNl: 'Meezingplaat!',
      titleEn: 'Sing-Along Hit!',
      descNl: 'Minstens 2 mensen zingen spontaan mee om het kampvuur.',
      descEn: 'Everyone sings along with the song chorus.',
      iconName: 'Volume2',
      color: 'from-yellow-400 to-amber-500',
      tags: ['custom_trait']
    },
    {
      id: 'custom_one_word',
      titleNl: 'Titel met 1 Woord',
      titleEn: '1-Word Title',
      descNl: 'De songtitel bestaat uit precies 1 woord.',
      descEn: 'Song title is exactly one word.',
      iconName: 'FileText',
      color: 'from-blue-600 to-indigo-700',
      tags: ['custom_trait']
    },
    {
      id: 'custom_duet_band',
      titleNl: 'Duet of Band (>2 leden)',
      titleEn: 'Duet or Band',
      descNl: 'Uitgevoerd door een samenwerking, duet of band.',
      descEn: 'Performed by a band, group, or duet.',
      iconName: 'Users',
      color: 'from-purple-600 to-violet-700',
      tags: ['custom_trait']
    },
    {
      id: 'custom_solo_female',
      titleNl: 'Solo Zangeres',
      titleEn: 'Solo Female Artist',
      descNl: 'Gezongen door een vrouwelijke solo-artiest.',
      descEn: 'Sung by a solo female vocalist.',
      iconName: 'Mic',
      color: 'from-pink-500 to-rose-600',
      tags: ['custom_trait']
    },
    {
      id: 'custom_solo_male',
      titleNl: 'Solo Zanger',
      titleEn: 'Solo Male Artist',
      descNl: 'Gezongen door een mannelijke solo-artiest.',
      descEn: 'Sung by a solo male vocalist.',
      iconName: 'User',
      color: 'from-blue-600 to-cyan-700',
      tags: ['custom_trait']
    },
    {
      id: 'custom_toast',
      titleNl: 'Proost Nummer! 🍻',
      titleEn: 'Cheers Song! 🍻',
      descNl: 'Iedereen neemt een slok van z\'n drankje bij dit nummer.',
      descEn: 'Everyone takes a sip of their drink during this song.',
      iconName: 'Sparkles',
      color: 'from-amber-400 to-amber-600',
      tags: ['custom_trait']
    }
  ];

  return [...categories, ...universalTraits];
}

export function getCategoriesForMode(mode: GameMode, customTracks?: CustomTrack[]): BingoCategory[] {
  switch (mode) {
    case 'sideA':
      return [...SIDE_A_CATEGORIES];
    case 'sideB':
      return [...SIDE_B_CATEGORIES];
    case 'campfire':
      return [...SIDE_A_CATEGORIES, ...CAMPFIRE_EXTRA_CATEGORIES];
    case 'custom':
      if (customTracks && customTracks.length > 0) {
        return generateCustomPlaylistCategories(customTracks);
      }
      return [...SIDE_A_CATEGORIES, ...SIDE_B_CATEGORIES];
    default:
      return [...SIDE_A_CATEGORIES];
  }
}

export function generateBingoBoard(
  roomSeed: number,
  playerSeed: number,
  gridSize: GridSize,
  mode: GameMode,
  language: Language,
  includeFreeSpace: boolean = true,
  customTracks?: CustomTrack[]
): BingoTile[] {
  const categories = getCategoriesForMode(mode, customTracks);
  const totalTiles = gridSize * gridSize;
  const rand = pseudoRandom(roomSeed + playerSeed * 9999);

  const shuffled = [...categories];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const tiles: BingoTile[] = [];
  const middleIndex = Math.floor(totalTiles / 2);

  for (let i = 0; i < totalTiles; i++) {
    if (includeFreeSpace && (gridSize === 3 || gridSize === 5) && i === middleIndex) {
      tiles.push({
        id: `free_${i}`,
        categoryId: 'free_space',
        title: language === 'nl' ? 'VRIJ VAKJE ⛺' : 'FREE SPACE ⛺',
        description: language === 'nl' ? 'Gratis afgekruist kampvuur vakje!' : 'Free marked campfire tile!',
        iconName: 'Flame',
        color: 'from-amber-500 to-red-500',
        isMarked: true,
      });
      continue;
    }

    const catObj = shuffled[i % shuffled.length];
    const isNl = language === 'nl';

    tiles.push({
      id: `tile_${i}_${catObj.id}`,
      categoryId: catObj.id,
      title: isNl ? catObj.titleNl : catObj.titleEn,
      description: isNl ? catObj.descNl : catObj.descEn,
      iconName: catObj.iconName,
      color: catObj.color,
      isMarked: false,
    });
  }

  return tiles;
}

/**
 * Bouwt een Hitster Bingo-scorekaart: vakjes in de vijf discobal-kleuren,
 * zo gelijkmatig mogelijk verdeeld en daarna geschud.
 *
 * Anders dan het oude bord staat er geen opdracht op een vakje — de kleur ís
 * de opdracht. Welke kleur telt, bepaalt de discobal per ronde.
 */
export function generateHitsterBoard(
  roomSeed: number,
  playerSeed: number,
  gridSize: GridSize,
  mode: GameMode,
  language: Language,
  includeFreeSpace: boolean = true
): BingoTile[] {
  const categories = getHitsterCategories(mode);
  const totalTiles = gridSize * gridSize;
  const rand = pseudoRandom(roomSeed + playerSeed * 9999);
  const isNl = language === 'nl';

  const middleIndex = Math.floor(totalTiles / 2);
  const hasFreeSpace = includeFreeSpace && (gridSize === 3 || gridSize === 5);
  const colouredCount = hasFreeSpace ? totalTiles - 1 : totalTiles;

  // Gelijkmatig verdelen: elke kleur even vaak, de rest willekeurig aangevuld
  const pool: HitsterColor[] = [];
  const perColour = Math.floor(colouredCount / categories.length);
  categories.forEach(cat => {
    for (let i = 0; i < perColour; i++) pool.push(cat.color);
  });
  while (pool.length < colouredCount) {
    pool.push(categories[Math.floor(rand() * categories.length)].color);
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const tiles: BingoTile[] = [];
  let poolIndex = 0;

  for (let i = 0; i < totalTiles; i++) {
    if (hasFreeSpace && i === middleIndex) {
      tiles.push({
        id: `free_${i}`,
        categoryId: 'free_space',
        title: isNl ? 'VRIJ VAKJE ⛺' : 'FREE SPACE ⛺',
        description: isNl ? 'Gratis afgekruist vakje!' : 'Free marked tile!',
        iconName: 'Flame',
        color: 'from-amber-500 to-red-500',
        isMarked: true,
      });
      continue;
    }

    const colour = pool[poolIndex++];
    const cat = categories.find(c => c.color === colour)!;

    tiles.push({
      id: `tile_${i}_${colour}`,
      categoryId: colour,
      title: isNl ? cat.labelNl : cat.labelEn,
      description: isNl ? cat.hintNl : cat.hintEn,
      iconName: 'Disc',
      color: cat.tileClass,
      isMarked: false,
      hitsterColor: colour,
    });
  }

  return tiles;
}

export interface WinCheckResult {
  hasWin: boolean;
  winningIndices: number[];
  winType?: 'row' | 'column' | 'diagonal' | 'fullHouse';
}

export function checkBingoWin(tiles: BingoTile[], gridSize: GridSize): WinCheckResult {
  const totalTiles = gridSize * gridSize;
  if (tiles.length !== totalTiles) {
    return { hasWin: false, winningIndices: [] };
  }

  const markedGrid: boolean[][] = [];
  for (let r = 0; r < gridSize; r++) {
    markedGrid[r] = [];
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      markedGrid[r][c] = tiles[idx]?.isMarked || false;
    }
  }

  const winningIndices = new Set<number>();
  let hasWin = false;
  let winType: 'row' | 'column' | 'diagonal' | 'fullHouse' | undefined;

  for (let r = 0; r < gridSize; r++) {
    let rowComplete = true;
    for (let c = 0; c < gridSize; c++) {
      if (!markedGrid[r][c]) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) {
      hasWin = true;
      winType = winType || 'row';
      for (let c = 0; c < gridSize; c++) {
        winningIndices.add(r * gridSize + c);
      }
    }
  }

  for (let c = 0; c < gridSize; c++) {
    let colComplete = true;
    for (let r = 0; r < gridSize; r++) {
      if (!markedGrid[r][c]) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      hasWin = true;
      winType = winType || 'column';
      for (let r = 0; r < gridSize; r++) {
        winningIndices.add(r * gridSize + c);
      }
    }
  }

  let mainDiagComplete = true;
  for (let i = 0; i < gridSize; i++) {
    if (!markedGrid[i][i]) {
      mainDiagComplete = false;
      break;
    }
  }
  if (mainDiagComplete) {
    hasWin = true;
    winType = winType || 'diagonal';
    for (let i = 0; i < gridSize; i++) {
      winningIndices.add(i * gridSize + i);
    }
  }

  let antiDiagComplete = true;
  for (let i = 0; i < gridSize; i++) {
    if (!markedGrid[i][gridSize - 1 - i]) {
      antiDiagComplete = false;
      break;
    }
  }
  if (antiDiagComplete) {
    hasWin = true;
    winType = winType || 'diagonal';
    for (let i = 0; i < gridSize; i++) {
      winningIndices.add(i * gridSize + (gridSize - 1 - i));
    }
  }

  const allMarked = tiles.every(t => t.isMarked);
  if (allMarked) {
    winType = 'fullHouse';
  }

  return {
    hasWin,
    winningIndices: Array.from(winningIndices),
    winType
  };
}
