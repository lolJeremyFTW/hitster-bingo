import type { CustomTrack } from '../types/hitster';

export interface SpotifyImportResult {
  name: string;
  tracks: CustomTrack[];
}

/**
 * Extracts Spotify Playlist ID from various URL formats:
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
 * - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
 * - 37i9dQZF1DXcBWIGoYBM5M
 */
export function extractSpotifyPlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const playlistMatch = trimmed.match(/playlist[\/:]([a-zA-Z0-9]{22})/);
  if (playlistMatch && playlistMatch[1]) {
    return playlistMatch[1];
  }
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Fetches playlist metadata using Spotify's public Embed API (No auth required!)
 */
export async function fetchSpotifyPlaylistPublic(playlistUrlOrId: string): Promise<SpotifyImportResult | null> {
  const playlistId = extractSpotifyPlaylistId(playlistUrlOrId);
  if (!playlistId) return null;

  try {
    // 1. Try Spotify oEmbed endpoint for playlist title
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
    const res = await fetch(oembedUrl);
    let playlistTitle = `Spotify Playlist (${playlistId.slice(0, 6)})`;

    if (res.ok) {
      const oembedData = await res.json();
      if (oembedData.title) {
        playlistTitle = oembedData.title;
      }
    }

    // 2. Fetch public iframe embed data which contains public track list details
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const embedRes = await fetch(embedUrl);
    const htmlText = await embedRes.text();

    const tracks: CustomTrack[] = [];

    // Extract JSON payload embedded inside Spotify iframe HTML (resource JSON data)
    const jsonMatch = htmlText.match(/<script id="resource" type="application\/json">(.*?)<\/script>/s) ||
                      htmlText.match(/<script id="initial-state" type="application\/json">(.*?)<\/script>/s);

    if (jsonMatch && jsonMatch[1]) {
      try {
        const payload = JSON.parse(jsonMatch[1]);
        // Extract tracks from Spotify embed resource schema
        const trackItems = payload?.tracks?.items || payload?.entity?.tracks?.items || payload?.data?.playlist?.tracksV2?.items || [];

        trackItems.forEach((item: any, idx: number) => {
          const trackObj = item.track || item.item || item;
          if (trackObj && trackObj.name) {
            const artistNames = trackObj.artists ? trackObj.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist';
            const albumYearStr = trackObj.album?.release_date || trackObj.release_date;
            let year: number | undefined;

            if (albumYearStr) {
              const yearMatch = albumYearStr.match(/\d{4}/);
              if (yearMatch) {
                year = parseInt(yearMatch[0], 10);
              }
            }

            tracks.push({
              id: `sp_${trackObj.id || idx}_${Date.now()}`,
              title: trackObj.name,
              artist: artistNames,
              year,
              spotifyUrl: trackObj.external_urls?.spotify || `https://open.spotify.com/track/${trackObj.id}`
            });
          }
        });
      } catch {
        // Fallback parsing
      }
    }

    return {
      name: playlistTitle,
      tracks
    };
  } catch (err) {
    console.error('Spotify import error:', err);
    return null;
  }
}

/**
 * Parses batch text (e.g. copied track lists from Spotify, text files, or Spotify web paste)
 * Formats supported:
 * - "Bohemian Rhapsody - Queen (1975)"
 * - "Hotel California by Eagles, 1976"
 * - "Title | Artist | 1985"
 * - "1. Track Name - Artist"
 */
export function parseBatchTracksText(rawText: string): CustomTrack[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const tracks: CustomTrack[] = [];

  lines.forEach((line, idx) => {
    // Strip leading track numbers like "1. ", "02 - "
    const cleanLine = line.replace(/^\d+[\.\s\-]+\s*/, '');

    // Extract release year if enclosed in parens or at the end e.g. (1984) or , 1984
    let year: number | undefined;
    const yearMatch = cleanLine.match(/[\(\[\,\s](\d{4})[\)\]\s]?/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Strip year portion for cleaner title/artist splitting
    const textWithoutYear = cleanLine.replace(/[\(\[\,]\s*\d{4}\s*[\)\]]?/, '').trim();

    let title = textWithoutYear;
    let artist = 'Unknown Artist';

    if (textWithoutYear.includes(' - ')) {
      const parts = textWithoutYear.split(' - ');
      title = parts[0].trim();
      artist = parts.slice(1).join(' - ').trim();
    } else if (textWithoutYear.includes(' by ')) {
      const parts = textWithoutYear.split(' by ');
      title = parts[0].trim();
      artist = parts.slice(1).join(' by ').trim();
    } else if (textWithoutYear.includes('|')) {
      const parts = textWithoutYear.split('|');
      title = parts[0].trim();
      if (parts[1]) artist = parts[1].trim();
    }

    tracks.push({
      id: `batch_${idx}_${Date.now()}`,
      title,
      artist,
      year
    });
  });

  return tracks;
}
