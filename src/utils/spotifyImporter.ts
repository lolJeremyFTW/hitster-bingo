import type { CustomTrack } from '../types/hitster';

export interface SpotifyImportResult {
  name: string;
  tracks: CustomTrack[];
  totalTracksInPlaylist?: number;
}

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
 * Super-Resilient Spotify Embed & Public Importer:
 * Explicitly fetches Spotify Embed iframe data (which contains up to 100 tracks per batch instead of 28)!
 */
export async function fetchSpotifyPlaylistPublic(playlistUrlOrId: string): Promise<SpotifyImportResult | null> {
  const playlistId = extractSpotifyPlaylistId(playlistUrlOrId);
  if (!playlistId) return null;

  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  
  // Try direct embed and public CORS proxies
  const proxySources = [
    embedUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(embedUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(embedUrl)}`
  ];

  let playlistTitle = 'Spotify Playlist';
  let tracks: CustomTrack[] = [];

  for (const targetUrl of proxySources) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        }
      });

      if (!res.ok) continue;

      const htmlText = await res.text();
      if (!htmlText || htmlText.length < 500) continue;

      // Extract all script JSON contents or window variable assignments
      const scriptMatches = Array.from(htmlText.matchAll(/<script[^>]*>(.*?)<\/script>/gs));

      for (const m of scriptMatches) {
        const content = m[1]?.trim();
        if (!content || content.length < 50) continue;

        let jsonCandidate: any = null;
        if (content.startsWith('{') || content.startsWith('[')) {
          try { jsonCandidate = JSON.parse(content); } catch { /* ignore */ }
        } else if (content.includes('JSON.parse(') || content.includes('state') || content.includes('entity')) {
          const rawMatch = content.match(/\{.*?\}/s);
          if (rawMatch) {
            try { jsonCandidate = JSON.parse(rawMatch[0]); } catch { /* ignore */ }
          }
        }

        if (!jsonCandidate) continue;

        // Recursive track extraction helper
        const extractTracksFromObj = (obj: any, depth = 0): void => {
          if (!obj || typeof obj !== 'object' || depth > 15) return;

          const trackTitle = obj.title || obj.name;

          if (obj.type === 'playlist' || obj.type === 'album') {
            if (obj.name || obj.title) playlistTitle = obj.name || obj.title;
          }

          if (trackTitle && (obj.artists || obj.subtitle || obj.type === 'track' || obj.entityType === 'track') && obj.type !== 'playlist') {
            const title = String(trackTitle).trim();
            let artist = 'Unknown Artist';
            if (Array.isArray(obj.artists)) {
              artist = obj.artists.map((a: any) => a.name || a).filter(Boolean).join(', ');
            } else if (typeof obj.subtitle === 'string') {
              artist = obj.subtitle;
            } else if (obj.artists?.items) {
              artist = obj.artists.items.map((a: any) => a.profile?.name || a.name).filter(Boolean).join(', ');
            }

            let year: number | undefined;
            const relDate = obj.album?.release_date || obj.releaseDate || obj.album?.date;
            if (relDate) {
              const yMatch = String(relDate).match(/\d{4}/);
              if (yMatch) year = parseInt(yMatch[0], 10);
            }

            let trackId = obj.id || obj.uid;
            if (obj.uri && typeof obj.uri === 'string' && obj.uri.includes('spotify:track:')) {
              trackId = obj.uri.split('spotify:track:')[1];
            }
            if (!trackId) trackId = `${title}_${artist}`;

            if (title && title.toLowerCase() !== 'title') {
              if (!tracks.some(t => t.id === trackId)) {
                tracks.push({
                  id: trackId,
                  title: title.trim(),
                  artist: artist ? artist.trim() : 'Unknown Artist',
                  year,
                  audioPreviewUrl: obj.audioPreview?.url || obj.preview_url || undefined,
                  spotifyUrl: `https://open.spotify.com/track/${trackId}`
                });
              }
            }
          }

          if (Array.isArray(obj)) {
            obj.forEach(item => extractTracksFromObj(item, depth + 1));
          } else {
            Object.values(obj).forEach(val => extractTracksFromObj(val, depth + 1));
          }
        };

        extractTracksFromObj(jsonCandidate);
        if (tracks.length > 0) break;
      }

      if (tracks.length > 0) {
        console.log(`[Spotify Public Importer] Loaded ${tracks.length} tracks from ${targetUrl}`);
        return { name: playlistTitle, tracks, totalTracksInPlaylist: tracks.length };
      }
    } catch {
      // Try next proxy
    }
  }

  return tracks.length > 0 ? { name: playlistTitle, tracks } : null;
}

/**
 * Super-Smart Batch Text / Spotify Paste Parser
 * Handles:
 * 1. Spotify Track URLs (e.g. https://open.spotify.com/track/7EQWtaBeTMsqe73xUUiVZ2)
 * 2. Tab-separated text (Title \t Artist \t Album \t Year)
 * 3. Multiline Spotify Web copy (Title on line 1, Artist on line 2, Album on line 3)
 * 4. Standard text ("Title - Artist" or "Artist - Title (Year)")
 */
export function parseBatchTracksText(rawText: string): CustomTrack[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const tracks: CustomTrack[] = [];

  // Mode 1: Check if input contains Spotify track URLs
  const trackUrlLines = lines.filter(l => l.includes('spotify.com/track/') || l.includes('spotify:track:'));
  if (trackUrlLines.length > 0) {
    trackUrlLines.forEach((line, idx) => {
      const match = line.match(/track[\/:]([a-zA-Z0-9]{22})/);
      const trackId = match ? match[1] : `url_${idx}`;
      
      // If line also has text before/after URL (e.g. "Bohemian Rhapsody - Queen https://open.spotify.com/track/...")
      const textWithoutUrl = line.replace(/https?:\/\/[^\s]+/g, '').replace(/spotify:track:[a-zA-Z0-9]{22}/g, '').trim();
      let title = '';
      let artist = 'Spotify Track';

      if (textWithoutUrl.includes(' - ')) {
        const parts = textWithoutUrl.split(' - ');
        title = parts[0].trim();
        artist = parts.slice(1).join(' - ').trim();
      } else if (textWithoutUrl.length > 0) {
        title = textWithoutUrl;
      }

      tracks.push({
        id: trackId,
        title: title || `Track ${idx + 1}`,
        artist: artist !== 'Spotify Track' ? artist : 'Spotify Link',
        spotifyUrl: `https://open.spotify.com/track/${trackId}`
      });
    });
    return tracks;
  }

  // Mode 2: Check for Tab-separated format (Spotify Desktop copy)
  const tabLines = lines.filter(l => l.includes('\t'));
  if (tabLines.length > 0) {
    tabLines.forEach((line, idx) => {
      const columns = line.split('\t').map(c => c.trim()).filter(Boolean);
      if (columns.length >= 2) {
        const title = columns[0];
        const artist = columns[1];
        let year: number | undefined;

        for (const col of columns) {
          const yMatch = col.match(/\b(19\d{2}|20[0-2]\d)\b/);
          if (yMatch) {
            year = parseInt(yMatch[1], 10);
            break;
          }
        }

        if (title && title.toLowerCase() !== 'title' && title.toLowerCase() !== 'titel') {
          tracks.push({
            id: `paste_tab_${idx}_${Date.now()}`,
            title,
            artist,
            year
          });
        }
      }
    });
    return tracks;
  }

  // Mode 3: Check for Multiline Spotify Web Copy (Title \n Artist \n Album \n Duration)
  // If lines don't contain ' - ' or '\t' and there are groups of 2-4 lines
  const hasHyphens = lines.some(l => l.includes(' - ') || l.includes(' • '));
  if (!hasHyphens && lines.length >= 2) {
    let i = 0;
    while (i < lines.length) {
      // Skip numbers/index lines like "1", "2", "3"
      if (/^\d+$/.test(lines[i])) {
        i++;
        continue;
      }
      const title = lines[i];
      const artist = lines[i + 1] && !/^\d+$/.test(lines[i + 1]) ? lines[i + 1] : 'Unknown Artist';
      
      if (title && title.length > 0) {
        let year: number | undefined;
        // Check if artist or next line contains year
        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          const yMatch = lines[j].match(/\b(19\d{2}|20[0-2]\d)\b/);
          if (yMatch) {
            year = parseInt(yMatch[1], 10);
            break;
          }
        }

        tracks.push({
          id: `paste_multi_${i}_${Date.now()}`,
          title: title.trim(),
          artist: artist.trim(),
          year
        });

        // Advance past artist (and optional album/duration lines if present)
        i += (artist !== 'Unknown Artist') ? 2 : 1;
        // Skip duration formatted like "3:14" or "03:14"
        if (i < lines.length && /^\d+:\d{2}$/.test(lines[i])) i++;
      } else {
        i++;
      }
    }
    if (tracks.length > 0) return tracks;
  }

  // Mode 4: Standard "Artist - Title" or "Title - Artist (Year)"
  lines.forEach((line, idx) => {
    const cleanLine = line.replace(/^\d+[\.\s\-]+\s*/, '');

    let year: number | undefined;
    const yearMatch = cleanLine.match(/[\(\[\,\s\•](\d{4})[\)\]\s]?/);
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
    } else if (textWithoutYear.includes(' • ')) {
      const parts = textWithoutYear.split(' • ');
      title = parts[0].trim();
      artist = parts.slice(1).join(' • ').trim();
    } else if (textWithoutYear.includes(' by ')) {
      const parts = textWithoutYear.split(' by ');
      title = parts[0].trim();
      artist = parts.slice(1).join(' by ').trim();
    } else if (textWithoutYear.includes('|')) {
      const parts = textWithoutYear.split('|');
      title = parts[0].trim();
      if (parts[1]) artist = parts[1].trim();
    }

    if (title && title.length > 0) {
      tracks.push({
        id: `paste_${idx}_${Date.now()}`,
        title,
        artist,
        year
      });
    }
  });

  return tracks;
}

/**
 * Automatically enriches tracks with release years and real artist names using Spotify API batch lookup or iTunes API fallback.
 */
export async function autoEnrichTracks(
  tracks: CustomTrack[],
  onProgress?: (msg: string, count: number) => void
): Promise<CustomTrack[]> {
  if (!tracks || tracks.length === 0) return tracks;

  const needsEnrichment = tracks.filter(t => !t.year || !t.artist || t.artist.includes('Spotify') || t.artist === 'Unknown Artist');
  if (needsEnrichment.length === 0) return tracks;

  // 1. Try Spotify Web API batch lookup (50 tracks/request) if token exists
  try {
    const { getValidAccessToken } = await import('./spotifyAuth');
    const token = await getValidAccessToken();

    if (token) {
      const trackMap = new Map<string, { title: string; artist: string; year?: number; previewUrl?: string }>();
      const trackIds = tracks.map(t => t.id).filter(id => /^[a-zA-Z0-9]{22}$/.test(id));

      if (trackIds.length > 0) {
        for (let i = 0; i < trackIds.length; i += 50) {
          const chunk = trackIds.slice(i, i + 50);
          if (onProgress) onProgress(`🔍 Spotify API Jaartallen ophalen (${Math.min(i + 50, trackIds.length)}/${trackIds.length})...`, i);

          const res = await fetch(`https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const data = await res.json();
            (data.tracks || []).forEach((tObj: any) => {
              if (tObj && tObj.id && tObj.name) {
                let year: number | undefined;
                if (tObj.album?.release_date) {
                  const yMatch = tObj.album.release_date.match(/\d{4}/);
                  if (yMatch) year = parseInt(yMatch[0], 10);
                }
                trackMap.set(tObj.id, {
                  title: tObj.name.trim(),
                  artist: tObj.artists ? tObj.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist',
                  year,
                  previewUrl: tObj.preview_url || undefined
                });
              }
            });
          }
        }
      }

      if (trackMap.size > 0) {
        const enriched = tracks.map(t => {
          const resObj = trackMap.get(t.id);
          if (resObj) {
            return {
              ...t,
              title: resObj.title || t.title,
              artist: resObj.artist && !resObj.artist.includes('Unknown') ? resObj.artist : t.artist,
              year: resObj.year || t.year,
              audioPreviewUrl: resObj.previewUrl || t.audioPreviewUrl
            };
          }
          return t;
        });
        if (onProgress) onProgress(`✅ ${trackMap.size} nummers verrijkt met jaartallen & artiesten!`, trackMap.size);
        return enriched;
      }
    }
  } catch (e) {
    console.warn('[AutoEnrich] Spotify API batch enrichment skipped:', e);
  }

  // 2. Fallback: iTunes Search API (Free, no credentials needed, 100% public!)
  if (onProgress) onProgress('🍎 iTunes API raadplegen voor jaartallen & artiesten...', 0);
  const enrichedTracks = [...tracks];
  let enrichedCount = 0;

  for (let i = 0; i < enrichedTracks.length; i += 10) {
    const chunk = enrichedTracks.slice(i, i + 10);
    const promises = chunk.map(async (t) => {
      if (!t.year || !t.artist || t.artist.includes('Spotify') || t.artist === 'Unknown Artist') {
        try {
          const cleanArtist = (t.artist && !t.artist.includes('Spotify') && t.artist !== 'Unknown Artist') ? t.artist : '';
          const searchTerm = `${t.title} ${cleanArtist}`.trim();
          const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=1`);
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              const item = data.results[0];
              let year: number | undefined;
              if (item.releaseDate) {
                const yMatch = String(item.releaseDate).match(/\d{4}/);
                if (yMatch) year = parseInt(yMatch[0], 10);
              }
              enrichedCount++;
              return {
                ...t,
                artist: (t.artist.includes('Spotify') || t.artist === 'Unknown Artist') ? (item.artistName || t.artist) : t.artist,
                year: year || t.year,
                audioPreviewUrl: t.audioPreviewUrl || item.previewUrl || undefined
              };
            }
          }
        } catch {
          // ignore
        }
      }
      return t;
    });

    const results = await Promise.all(promises);
    for (let j = 0; j < results.length; j++) {
      enrichedTracks[i + j] = results[j];
    }
  }

  if (onProgress) onProgress(`🎉 ${enrichedCount} nummers aangevuld met jaartal!`, enrichedCount);
  return enrichedTracks;
}

/**
 * Automatically resolves track titles, artists, and release years for Spotify track URLs
 */
export async function resolveTrackUrlsWithOEmbed(tracks: CustomTrack[]): Promise<CustomTrack[]> {
  return autoEnrichTracks(tracks);
}

export async function scrapeSpotifyPlaylistWithLiveLogs(
  playlistUrl: string,
  onLog: (message: string, count: number) => void,
  clientId?: string,
  clientSecret?: string
): Promise<SpotifyImportResult | null> {
  try {
    const res = await fetch('/api/scrape-playlist-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: playlistUrl, clientId, clientSecret })
    });

    if (!res.ok || !res.body) {
      throw new Error(`Server status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finalTracks: CustomTrack[] = [];

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
                name: 'Gecrawlde Playlist',
                tracks: finalTracks,
                totalTracksInPlaylist: finalTracks.length
              };
            }
          } catch {
            // Continue
          }
        }
      }
    }

    if (finalTracks.length > 0) {
      return {
        name: 'Gecrawlde Playlist',
        tracks: finalTracks,
        totalTracksInPlaylist: finalTracks.length
      };
    }
  } catch (err: any) {
    onLog(`❌ Scraper stream fout: ${err.message || 'Verbinding verbroken'}`, 0);
  }

  return null;
}

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
