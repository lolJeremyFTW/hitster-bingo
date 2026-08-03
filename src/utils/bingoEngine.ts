import type { BingoCategory, BingoTile, GameMode, GridSize, Language } from '../types/hitster';
import { CAMPFIRE_EXTRA_CATEGORIES, SIDE_A_CATEGORIES, SIDE_B_CATEGORIES } from '../data/categories';

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

export function getCategoriesForMode(mode: GameMode): BingoCategory[] {
  switch (mode) {
    case 'sideA':
      return [...SIDE_A_CATEGORIES];
    case 'sideB':
      return [...SIDE_B_CATEGORIES];
    case 'campfire':
      return [...SIDE_A_CATEGORIES, ...CAMPFIRE_EXTRA_CATEGORIES];
    case 'custom':
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
  includeFreeSpace: boolean = true
): BingoTile[] {
  const categories = getCategoriesForMode(mode);
  const totalTiles = gridSize * gridSize;
  const rand = pseudoRandom(roomSeed + playerSeed * 9999);

  // Shuffle categories using seeded PRNG
  const shuffled = [...categories];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const tiles: BingoTile[] = [];
  const middleIndex = Math.floor(totalTiles / 2);

  for (let i = 0; i < totalTiles; i++) {
    // Check for middle free space in odd grid sizes (3x3, 5x5)
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

    // Pick category, repeating if category list is smaller than grid size
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

  // 1. Check Rows
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

  // 2. Check Columns
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

  // 3. Check Main Diagonal (top-left to bottom-right)
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

  // 4. Check Anti-Diagonal (top-right to bottom-left)
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

  // 5. Full House check
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
