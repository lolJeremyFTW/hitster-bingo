import type { CustomTrack } from '../types/hitster';

export interface SpotifyImportResult {
  name: string;
  tracks: CustomTrack[];
  totalTracksInPlaylist?: number;
}

/**
 * Extracts Spotify Playlist ID from various URL formats
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
 * Call Built-in Local Live Streaming Scraper API (/api/scrape-playlist-stream)
 * Streams real-time progress logs e.g. "[Scroll 14/150] Captured 340 tracks" to UI
 */
export async function scrapeSpotifyPlaylistWithLiveLogs(
  playlistUrl: string,
  onLog: (message: string, count: number) => void
): Promise<SpotifyImportResult | null> {
  try {
    const res = await fetch('/api/scrape-playlist-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: playlistUrl })
    });

    if (!res.ok || !res.body) {
      throw new Error(`Server status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finalTracks: CustomTrack[] = [];
    let playlistName = 'Gecrawlde Spotify Playlist';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.message) {
              onLog(payload.message, payload.count || 0);
            }
            if (payload.tracks && payload.tracks.length > 0) {
              finalTracks = payload.tracks;
            }
            if (payload.isDone && finalTracks.length > 0) {
              return {
                name: playlistName,
                tracks: finalTracks,
                totalTracksInPlaylist: finalTracks.length
              };
            }
          } catch {
            // Partial line chunk, continue
          }
        }
      }
    }

    if (finalTracks.length > 0) {
      return {
        name: playlistName,
        tracks: finalTracks,
        totalTracksInPlaylist: finalTracks.length
      };
    }
  } catch (err: any) {
    onLog(`❌ Scraper stream fout: ${err.message || 'Verbinding verbroken'}`, 0);
  }

  return null;
}

/**
 * Fetches ALL 800+ tracks directly from Spotify's Official Web API using Client Credentials
 */
export async function fetchAllTracksFromSpotifyAPI(
  playlistId: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyImportResult | null> {
  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'client_credentials');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId.trim()}:${clientSecret.trim()}`)
      },
      body: bodyParams
    });

    if (!tokenRes.ok) return null;

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return null;

    const playlistDetailsRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    let playlistTitle = 'Spotify Playlist';
    if (playlistDetailsRes.ok) {
      const details = await playlistDetailsRes.json();
      if (details.name) playlistTitle = details.name;
    }

    let offset = 0;
    const limit = 100;
    let allTracks: CustomTrack[] = [];
    let totalPlaylistCount = 0;

    while (offset < 2000) {
      const tracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!tracksRes.ok) break;

      const tracksData = await tracksRes.json();
      totalPlaylistCount = tracksData.total || totalPlaylistCount;
      const items = tracksData.items || [];

      items.forEach((item: any, idx: number) => {
        const trackObj = item.track;
        if (trackObj && trackObj.name) {
          const title = trackObj.name;
          const artist = trackObj.artists ? trackObj.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist';
          let year: number | undefined;

          if (trackObj.album?.release_date) {
            const yMatch = trackObj.album.release_date.match(/\d{4}/);
            if (yMatch) year = parseInt(yMatch[0], 10);
          }

          allTracks.push({
            id: trackObj.id || `sp_${offset + idx}_${Date.now()}`,
            title: title.trim(),
            artist: artist.trim(),
            year,
            audioPreviewUrl: trackObj.preview_url || undefined,
            spotifyUrl: trackObj.external_urls?.spotify || `https://open.spotify.com/track/${trackObj.id}`
          });
        }
      });

      if (items.length === 0 || allTracks.length >= totalPlaylistCount) {
        break;
      }

      offset += limit;
    }

    return {
      name: playlistTitle,
      tracks: allTracks,
      totalTracksInPlaylist: totalPlaylistCount
    };
  } catch (err) {
    console.error('Spotify API Fetch Error:', err);
    return null;
  }
}

/**
 * Public Embed Fallback Importer
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
              return { name: playlistTitle, tracks, totalTracksInPlaylist: tracks.length };
            }
          }
        } catch {
          // Continue
        }
      }
    } catch {
      // Continue
    }
  }

  return tracks.length > 0 ? { name: playlistTitle, tracks } : null;
}

/**
 * Parses batch text
 */
export function parseBatchTracksText(rawText: string): CustomTrack[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const tracks: CustomTrack[] = [];

  lines.forEach((line, idx) => {
    const cleanLine = line.replace(/^\d+[\.\s\-]+\s*/, '');

    let year: number | undefined;
    const yearMatch = cleanLine.match(/[\(\[\,\s](\d{4})[\)\]\s]?/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

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
