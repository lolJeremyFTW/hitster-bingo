/**
 * De officiële Hitster-edities.
 *
 * Bewust geen Spotify-ID's hardcoded: die veranderen en zijn niet te
 * controleren zonder ze op te zoeken. Het standaard-deck in dit project stond
 * vol met verzonnen track-ID's die nergens naar verwezen, en dat wil je niet
 * herhalen. In plaats daarvan zoeken we de lijsten live op via de Spotify API,
 * zodat wat je krijgt gegarandeerd bestaat.
 */

export interface HitsterEdition {
  id: string;
  name: string;
  description: string;
  /** Waarop we bij Spotify zoeken */
  query: string;
  emoji: string;
}

export const HITSTER_EDITIONS: HitsterEdition[] = [
  {
    id: 'original',
    name: 'Hitster Originele NL',
    description: 'De basisversie met de breedste mix aan muziek.',
    query: 'Hitster Nederlands',
    emoji: '🎵',
  },
  {
    id: 'nl100',
    name: 'Hitster 100% NL',
    description: 'Alleen Nederlandstalige hits, samen met radiozender 100% NL.',
    query: 'Hitster 100% NL',
    emoji: '🇳🇱',
  },
  {
    id: 'summer',
    name: 'Hitster Summer Party',
    description: 'Zomerhits en dance.',
    query: 'Hitster Summer Party',
    emoji: '🌴',
  },
  {
    id: 'guilty',
    name: 'Hitster Guilty Pleasures',
    description: 'Nummers waar je stiekem van houdt.',
    query: 'Hitster Guilty Pleasures',
    emoji: '🙈',
  },
  {
    id: 'generations',
    name: 'Hitster Battle of the Generations',
    description: 'Per generatie raden.',
    query: 'Hitster Battle of the Generations',
    emoji: '👨‍👩‍👧',
  },
  {
    id: 'bingo',
    name: 'Hitster Bingo',
    description: 'De bingo-editie.',
    query: 'Hitster Bingo',
    emoji: '🎱',
  },
  {
    id: 'celebration',
    name: 'Hitster Celebration',
    description: 'Feesteditie.',
    query: 'Hitster Celebration',
    emoji: '🎉',
  },
  {
    id: 'rock',
    name: 'Hitster Rock',
    description: 'Uitbreiding met rocknummers.',
    query: 'Hitster Rock',
    emoji: '🎸',
  },
];

export interface FoundPlaylist {
  editionId: string;
  editionName: string;
  emoji: string;
  playlistId: string;
  playlistName: string;
  owner: string;
  trackCount: number;
  url: string;
  image?: string;
}

/**
 * Zoekt per editie de bijpassende publieke playlist op Spotify.
 *
 * Resultaten worden gefilterd op naam: een zoekopdracht op "Hitster Rock"
 * levert ook willekeurige rocklijsten op, en die wil je niet als officiële
 * editie presenteren.
 */
export async function findHitsterPlaylists(
  token: string,
  onProgress?: (message: string, done: number, total: number) => void
): Promise<FoundPlaylist[]> {
  const gevonden: FoundPlaylist[] = [];
  const gezien = new Set<string>();
  let done = 0;

  for (const editie of HITSTER_EDITIONS) {
    onProgress?.(`🔎 Zoeken naar ${editie.name}…`, done, HITSTER_EDITIONS.length);

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(editie.query)}&type=playlist&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        // Spotify geeft soms null-items terug tussen de resultaten
        const items: any[] = (data.playlists?.items ?? []).filter(Boolean);

        const treffer = items.find(p => {
          const naam = (p.name ?? '').toLowerCase();
          if (!naam.includes('hitster')) return false;
          if (gezien.has(p.id)) return false;
          // Minimaal een handvol nummers, anders is het een lege naamgenoot
          return (p.tracks?.total ?? 0) >= 20;
        });

        if (treffer) {
          gezien.add(treffer.id);
          gevonden.push({
            editionId: editie.id,
            editionName: editie.name,
            emoji: editie.emoji,
            playlistId: treffer.id,
            playlistName: treffer.name,
            owner: treffer.owner?.display_name ?? 'onbekend',
            trackCount: treffer.tracks?.total ?? 0,
            url: treffer.external_urls?.spotify ?? `https://open.spotify.com/playlist/${treffer.id}`,
            image: treffer.images?.[0]?.url,
          });
        }
      }
    } catch {
      // Eén mislukte editie mag de rest niet tegenhouden
    }

    done++;
  }

  onProgress?.(
    gevonden.length > 0
      ? `✅ ${gevonden.length} van ${HITSTER_EDITIONS.length} edities gevonden op Spotify.`
      : '⚠️ Geen officiële Hitster-lijsten gevonden.',
    done,
    HITSTER_EDITIONS.length
  );

  return gevonden;
}
