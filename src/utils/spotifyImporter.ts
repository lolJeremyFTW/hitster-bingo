import type { CustomTrack } from '../types/hitster';

export interface SpotifyImportResult {
  name: string;
  tracks: CustomTrack[];
}

/**
 * Extracts Spotify Playlist ID from various URL formats:
 * - https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3?si=...
 * - spotify:playlist:5zSKBda7QTnWMHecVs20E3
 * - 5zSKBda7QTnWMHecVs20E3
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
 * Fetches Spotify playlist track metadata using multiple resilient fallback strategies:
 * 1. Direct Spotify Embed API
 * 2. AllOrigins CORS Proxy
 * 3. Corsproxy.io
 * 4. Spotify oEmbed API
 */
export async function fetchSpotifyPlaylistPublic(playlistUrlOrId: string): Promise<SpotifyImportResult | null> {
  const playlistId = extractSpotifyPlaylistId(playlistUrlOrId);
  if (!playlistId) return null;

  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const proxySources = [
    embedUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(embedUrl)}`
  ];

  let playlistTitle = 'Spotify Playlist';
  let tracks: CustomTrack[] = [];

  // Try each source URL until we get a valid HTML page containing Next.js or Embed state JSON
  for (const targetUrl of proxySources) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        }
      });

      if (!res.ok) continue;

      const htmlText = await res.text();
      if (!htmlText || htmlText.length < 500) continue;

      // Extract JSON payload embedded inside Spotify iframe HTML
      const jsonMatch = htmlText.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s) ||
                        htmlText.match(/<script id="resource" type="application\/json">(.*?)<\/script>/s) ||
                        htmlText.match(/<script id="initial-state" type="application\/json">(.*?)<\/script>/s);

      if (jsonMatch && jsonMatch[1]) {
        try {
          const payload = JSON.parse(jsonMatch[1]);
          const entity = payload?.props?.pageProps?.state?.data?.entity || payload?.entity || payload?.data?.entity;

          if (entity) {
            if (entity.name) playlistTitle = entity.name;

            const rawItems = entity.trackList || entity.tracks?.items || [];
            rawItems.forEach((item: any, idx: number) => {
              const title = item.title || item.name || item.track?.name;
              const artist = item.subtitle || (item.artists ? item.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist');
              const previewUrl = item.audioPreview?.url || item.preview_url || item.track?.preview_url;

              let trackId = item.id || item.uid || `sp_${idx}_${Date.now()}`;
              if (item.uri && item.uri.includes('spotify:track:')) {
                trackId = item.uri.split('spotify:track:')[1];
              }

              // Extract or generate release year from track details
              let year: number | undefined;
              if (item.releaseDate) {
                const yMatch = item.releaseDate.match(/\d{4}/);
                if (yMatch) year = parseInt(yMatch[0], 10);
              }

              if (title) {
                tracks.push({
                  id: trackId,
                  title: title.trim(),
                  artist: artist ? artist.trim() : 'Unknown Artist',
                  year,
                  audioPreviewUrl: previewUrl || undefined,
                  spotifyUrl: `https://open.spotify.com/track/${trackId}`
                });
              }
            });

            if (tracks.length > 0) {
              return { name: playlistTitle, tracks };
            }
          }
        } catch {
          // JSON parsing failed, try next source
        }
      }
    } catch {
      // Network fetch error on this source, continue to next fallback
    }
  }

  // 5. Ultimate Fallback: Fetch Spotify oEmbed endpoint for title
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
    const oembedRes = await fetch(oembedUrl);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData.title) {
        playlistTitle = oembedData.title;
      }
    }
  } catch {
    // Ignore
  }

  return tracks.length > 0 ? { name: playlistTitle, tracks } : null;
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
