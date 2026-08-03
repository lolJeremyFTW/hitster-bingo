/**
 * Jaartal-correctie via MusicBrainz
 *
 * Het probleem: Spotify geeft `album.release_date` — de datum van het álbum
 * waarop de track in die playlist staat. Voor een greatest-hits, remaster of
 * compilatie is dat niet het jaar waarin het nummer uitkwam. "Bohemian
 * Rhapsody" op een 2011-remaster levert 2011 op in plaats van 1975.
 *
 * Voor Hitster is het jaartal het hele spel, dus dat moet kloppen. MusicBrainz
 * kent per opname een `first-release-date` — precies wat we nodig hebben.
 *
 * MusicBrainz staat 1 request per seconde toe voor anonieme clients. Daarom
 * checken we alleen tracks waar het Spotify-jaar verdacht is, niet de hele lijst.
 */

import type { CustomTrack } from '../types/hitster';

const MB_BASE = 'https://musicbrainz.org/ws/2/recording';
// Browsers laten geen custom User-Agent toe; MusicBrainz accepteert ?client= als alternatief
const MB_CLIENT = 'hitster-bingo-0.1.0';
const MB_RATE_LIMIT_MS = 1100;

/** Albumtitels die erop wijzen dat het jaartal een heruitgave is */
const SUSPECT_ALBUM = /\b(greatest hits|best of|the best|collection|anthology|compilation|remaster(ed)?|deluxe|anniversary|edition|essential|ultimate|hits|volume \d|vol\.? ?\d|live at|live in|soundtrack|now that's what)\b/i;

/** Suffixes die Spotify aan tracktitels plakt en die MusicBrainz niet kent */
const TITLE_NOISE = /\s*[-–(\[]\s*(\d{4}\s*)?(remaster(ed)?|remix|radio edit|single version|album version|mono|stereo|live|acoustic|deluxe|bonus track|feat\.?|ft\.?)[^)\]]*[)\]]?\s*$/gi;

export interface YearResolveResult {
  tracks: CustomTrack[];
  correctedCount: number;
  checkedCount: number;
}

function cleanTitle(title: string): string {
  return title.replace(TITLE_NOISE, '').replace(/\s+/g, ' ').trim();
}

function primaryArtist(artist: string): string {
  // MusicBrainz matcht slechter op "Queen, David Bowie" dan op "Queen"
  return artist.split(/,|&|feat\.?|ft\.?|\bx\b/i)[0].trim();
}

/**
 * Een track is verdacht als het jaar ontbreekt, of als het album een
 * heruitgave lijkt, of als het jaartal onwaarschijnlijk recent is voor het
 * soort album waar het op staat.
 */
export function needsYearCheck(track: CustomTrack): boolean {
  if (!track.year) return true;
  if (track.albumName && SUSPECT_ALBUM.test(track.albumName)) return true;
  if (TITLE_NOISE.test(track.title)) {
    TITLE_NOISE.lastIndex = 0; // globale regex houdt state bij
    return true;
  }
  TITLE_NOISE.lastIndex = 0;
  return false;
}

/**
 * Het jaar dat we willen zit NIET in `recording.first-release-date` — dat veld
 * slaat op de specifieke opname-variant en is vaak leeg of van een heruitgave.
 * De betrouwbare bron is de release-group van de releases waarop de opname
 * staat: daarvan het vroegste jaar. Getest tegen bekende gevallen (Bohemian
 * Rhapsody 1975, Africa 1982, Hotel California 1976, Sweet Caroline 1969).
 */
async function lookupFirstReleaseYear(
  title: string,
  artist: string,
  attempt = 0
): Promise<number | null> {
  const query = `recording:"${cleanTitle(title)}" AND artist:"${primaryArtist(artist)}"`;
  const url = `${MB_BASE}?query=${encodeURIComponent(query)}&fmt=json&limit=100&client=${MB_CLIENT}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    // 503 = rate limit of tijdelijk overbelast; even wachten en opnieuw
    if (res.status === 503 && attempt < 2) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      return lookupFirstReleaseYear(title, artist, attempt + 1);
    }

    if (!res.ok) return null;

    const data = await res.json();
    // Alleen near-exact matches — lagere scores leveren covers en naamgenoten op
    const recordings: any[] = (data.recordings || []).filter((r: any) => (r.score ?? 0) >= 95);
    if (recordings.length === 0) return null;

    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (const rec of recordings) {
      for (const release of rec.releases || []) {
        const date: string | undefined =
          release['release-group']?.['first-release-date'] || release.date;
        if (!date) continue;
        const y = parseInt(String(date).slice(0, 4), 10);
        if (y >= 1900 && y <= currentYear) years.push(y);
      }
    }

    if (years.length === 0) return null;
    return Math.min(...years);
  } catch {
    return null;
  }
}

/**
 * Loopt de verdachte tracks langs en corrigeert hun jaartal.
 * Respecteert de rate limit van MusicBrainz (1 req/s), dus dit duurt ongeveer
 * één seconde per verdachte track.
 */
export async function resolveOriginalYears(
  tracks: CustomTrack[],
  onProgress?: (message: string, done: number, total: number) => void,
  shouldCancel?: () => boolean
): Promise<YearResolveResult> {
  const suspects = tracks.filter(needsYearCheck);

  if (suspects.length === 0) {
    onProgress?.('✅ Alle jaartallen zien er betrouwbaar uit.', 0, 0);
    return { tracks, correctedCount: 0, checkedCount: 0 };
  }

  onProgress?.(
    `🔍 ${suspects.length} van ${tracks.length} nummers hebben een verdacht jaartal — controleren bij MusicBrainz (~${Math.ceil(suspects.length * 1.1)}s)...`,
    0,
    suspects.length
  );

  const corrections = new Map<string, number>();
  let done = 0;

  for (const track of suspects) {
    if (shouldCancel?.()) {
      onProgress?.(`⏹️ Gestopt na ${done} nummers.`, done, suspects.length);
      break;
    }

    const year = await lookupFirstReleaseYear(track.title, track.artist);
    if (year && year !== track.year) {
      corrections.set(track.id, year);
    }

    done++;
    if (done % 5 === 0 || done === suspects.length) {
      onProgress?.(
        `🔍 ${done}/${suspects.length} gecontroleerd, ${corrections.size} jaartallen gecorrigeerd...`,
        done,
        suspects.length
      );
    }

    // Rate limit respecteren; anders blokkeert MusicBrainz het IP
    if (done < suspects.length) {
      await new Promise(r => setTimeout(r, MB_RATE_LIMIT_MS));
    }
  }

  const updated = tracks.map(t => {
    const corrected = corrections.get(t.id);
    if (corrected) {
      return { ...t, year: corrected, yearSource: 'musicbrainz' as const };
    }
    return t;
  });

  onProgress?.(
    `🎉 Klaar! ${corrections.size} jaartallen gecorrigeerd naar de originele release.`,
    done,
    suspects.length
  );

  return { tracks: updated, correctedCount: corrections.size, checkedCount: done };
}
