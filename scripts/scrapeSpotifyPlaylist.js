/**
 * Spotify Playlist Importer — Official Web API approach
 * 
 * Uses the Spotify Web API (client credentials flow) to fetch ALL tracks
 * from a public playlist, paginated 100 at a time. No browser needed.
 * 
 * Usage:
 *   node scripts/scrapeSpotifyPlaylist.js <playlist-url> [clientId] [clientSecret]
 */
import fs from 'fs';
import path from 'path';

/**
 * Extract playlist ID from a Spotify URL or raw ID
 */
export function extractPlaylistId(urlOrId) {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/playlist[\/:]([ a-zA-Z0-9]{22})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Get an access token using Spotify Client Credentials flow
 */
async function getAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    },
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Try to get an anonymous access token from Spotify's web player endpoint.
 * This is the same token the web player uses before login.
 */
async function getAnonymousToken() {
  try {
    const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Fetch ALL tracks from a Spotify playlist using the Web API.
 * Paginates through all pages (100 tracks per page).
 * 
 * @param {string} playlistId - Spotify playlist ID
 * @param {string} accessToken - Spotify access token
 * @param {function} onLog - Callback for progress logging
 * @returns {{ name: string, tracks: Array }} 
 */
export async function fetchAllPlaylistTracks(playlistId, accessToken, onLog) {
  const log = (msg, count = 0) => {
    console.log(msg);
    if (onLog) onLog(msg, count);
  };

  // First, get playlist metadata
  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,tracks.total`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Playlist metadata failed (${metaRes.status}): ${errText}`);
  }

  const meta = await metaRes.json();
  const playlistName = meta.name || 'Spotify Playlist';
  const totalTracks = meta.tracks?.total || 0;

  log(`🎶 Playlist: "${playlistName}" — ${totalTracks} nummers totaal`);

  const allTracks = [];
  let offset = 0;
  const limit = 100;

  while (offset < totalTracks) {
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists(name),album(name,release_date),preview_url,external_urls))`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      log(`⚠️ Pagina ${Math.floor(offset / limit) + 1} mislukt (status ${res.status}), stoppen...`);
      break;
    }

    const data = await res.json();
    const items = data.items || [];

    if (items.length === 0) break;

    for (const item of items) {
      const track = item.track;
      if (!track || !track.name) continue; // Skip null/local tracks

      const title = track.name;
      const artist = track.artists ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist';
      let year;
      if (track.album?.release_date) {
        const yMatch = track.album.release_date.match(/\d{4}/);
        if (yMatch) year = parseInt(yMatch[0], 10);
      }

      allTracks.push({
        id: track.id || `sp_${allTracks.length}`,
        title: title.trim(),
        artist: artist.trim(),
        year,
        audioPreviewUrl: track.preview_url || undefined,
        spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
      });
    }

    log(`📦 Pagina ${Math.floor(offset / limit) + 1}: ${items.length} nummers opgehaald (${allTracks.length}/${totalTracks} totaal)`, allTracks.length);
    offset += limit;
  }

  log(`🎉 KLAAR! ${allTracks.length} van ${totalTracks} nummers succesvol opgehaald!`, allTracks.length);

  return {
    name: playlistName,
    tracks: allTracks
  };
}

/**
 * Main entry: fetch all tracks from a Spotify playlist URL
 */
export async function importSpotifyPlaylist(playlistUrl, clientId, clientSecret, onLog) {
  const log = (msg, count = 0) => {
    console.log(msg);
    if (onLog) onLog(msg, count);
  };

  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    throw new Error(`Ongeldige Spotify URL: ${playlistUrl}`);
  }

  log(`🚀 Spotify Playlist Import starten voor: ${playlistId}`);

  let accessToken = null;

  // Method 1: Client Credentials (if provided)
  if (clientId && clientSecret) {
    log('🔑 Authenticeren met Spotify API credentials...');
    try {
      accessToken = await getAccessToken(clientId, clientSecret);
      log('✅ Spotify API token verkregen!');
    } catch (err) {
      log(`⚠️ Client credentials mislukt: ${err.message}`);
    }
  }

  // Method 2: Anonymous token fallback
  if (!accessToken) {
    log('🔓 Proberen met anoniem Spotify token...');
    accessToken = await getAnonymousToken();
    if (accessToken) {
      log('✅ Anoniem token verkregen!');
    } else {
      log('❌ Geen anoniem token beschikbaar. Geef Spotify API credentials op.');
      throw new Error('Geen toegangstoken beschikbaar. Maak een gratis Spotify app aan op https://developer.spotify.com/dashboard');
    }
  }

  return fetchAllPlaylistTracks(playlistId, accessToken, onLog);
}

// CLI usage
if (process.argv[1] && process.argv[1].endsWith('scrapeSpotifyPlaylist.js')) {
  const url = process.argv[2] || 'https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3';
  const clientId = process.argv[3] || process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.argv[4] || process.env.SPOTIFY_CLIENT_SECRET;

  importSpotifyPlaylist(url, clientId, clientSecret).then(result => {
    const outputPath = path.join(process.cwd(), 'src', 'data', 'myScrapedPlaylist.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`💾 Saved ${result.tracks.length} tracks to ${outputPath}`);
  }).catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  });
}
