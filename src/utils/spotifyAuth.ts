/**
 * Spotify OAuth PKCE (Proof Key for Code Exchange) Module
 * 
 * Implements the Authorization Code with PKCE flow for Spotify.
 * No client_secret needed — just a Client ID.
 * Supports private playlists because the user logs in directly.
 * 
 * Flow:
 * 1. User clicks "Login met Spotify"
 * 2. Redirect to Spotify auth page
 * 3. User approves → redirected back with ?code=...
 * 4. Exchange code for access_token using PKCE verifier
 * 5. Use token to fetch all playlist tracks
 */

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const REDIRECT_URI = window.location.origin;
const SCOPES = 'playlist-read-private playlist-read-collaborative';

// Storage keys
const STORAGE_KEYS = {
  CLIENT_ID: 'hitster_sp_client_id',
  ACCESS_TOKEN: 'hitster_sp_access_token',
  REFRESH_TOKEN: 'hitster_sp_refresh_token',
  TOKEN_EXPIRY: 'hitster_sp_token_expiry',
  CODE_VERIFIER: 'hitster_sp_code_verifier',
} as const;

/**
 * Generate a random string for PKCE code verifier
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

/**
 * Create SHA-256 hash and base64url encode it for PKCE challenge
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Initiate Spotify OAuth PKCE login flow
 * Redirects the browser to Spotify's authorization page
 */
export async function initiateSpotifyLogin(clientId: string): Promise<void> {
  if (!clientId.trim()) {
    throw new Error('Client ID is vereist');
  }

  // Store client ID
  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(64);
  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlEncode(hashed);

  // Build auth URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId.trim(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
  });

  // Redirect to Spotify
  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback — exchange the authorization code for tokens
 * Call this on page load to check if we're returning from Spotify auth
 */
export async function handleSpotifyCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    console.error('[Spotify OAuth] Auth error:', error);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }

  if (!code) return false;

  const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);

  if (!codeVerifier || !clientId) {
    console.error('[Spotify OAuth] Missing code verifier or client ID');
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error_description || errData.error || 'Token exchange failed');
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + data.expires_in * 1000));

    // Clean URL (remove ?code=... from address bar)
    window.history.replaceState({}, document.title, window.location.pathname);

    console.log('[Spotify OAuth] Successfully authenticated!');
    return true;
  } catch (err) {
    console.error('[Spotify OAuth] Token exchange error:', err);
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);

  if (!refreshToken || !clientId) return null;

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) return null;

    const data = await response.json();
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + data.expires_in * 1000));

    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Get a valid access token (refreshing if needed)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

  if (!token) return null;

  // Check if token is expired (with 60s buffer)
  if (expiry && Date.now() > parseInt(expiry, 10) - 60000) {
    return refreshAccessToken();
  }

  return token;
}

/**
 * Check if user is currently authenticated with Spotify
 */
export function isSpotifyAuthenticated(): boolean {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry, 10);
}

/**
 * Get stored client ID
 */
export function getStoredClientId(): string {
  return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
}

/**
 * Logout from Spotify (clear all tokens)
 */
export function logoutSpotify(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}

/**
 * Fetch ALL tracks from a Spotify playlist using the user's OAuth token.
 * Paginates through all pages (100 tracks per page).
 * Works for both public AND private playlists!
 */
export async function fetchPlaylistTracksWithOAuth(
  playlistUrl: string,
  onLog?: (message: string, count: number) => void
): Promise<{ name: string; tracks: import('../types/hitster').CustomTrack[] } | null> {
  const log = (msg: string, count = 0) => {
    if (onLog) onLog(msg, count);
  };

  // Extract playlist ID
  const match = playlistUrl.match(/playlist[\/:]([ a-zA-Z0-9]{22})/);
  const playlistId = match ? match[1] : playlistUrl.trim();

  if (!playlistId || playlistId.length < 10) {
    log('❌ Ongeldige Spotify playlist URL');
    return null;
  }

  // Get valid token
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    log('❌ Niet ingelogd bij Spotify. Klik op "Login met Spotify".');
    return null;
  }

  log('🎵 Playlist metadata ophalen...');

  // Get playlist metadata
  const metaRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,tracks.total`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      // Token expired, try refresh
      const newToken = await refreshAccessToken();
      if (!newToken) {
        log('❌ Spotify sessie verlopen. Log opnieuw in.');
        logoutSpotify();
        return null;
      }
      // Retry with new token
      return fetchPlaylistTracksWithOAuth(playlistUrl, onLog);
    }
    log(`❌ Kan playlist niet laden (status ${metaRes.status})`);
    return null;
  }

  const meta = await metaRes.json();
  const playlistName = meta.name || 'Spotify Playlist';
  const totalTracks = meta.tracks?.total || 0;

  log(`🎶 "${playlistName}" — ${totalTracks} nummers gevonden!`);

  // Paginate through ALL tracks
  const allTracks: import('../types/hitster').CustomTrack[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < totalTracks) {
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists(name),album(name,release_date),preview_url,external_urls))`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      log(`⚠️ Pagina ${Math.floor(offset / limit) + 1} mislukt (${res.status})`);
      break;
    }

    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      const track = item.track;
      if (!track || !track.name) continue;

      let year: number | undefined;
      if (track.album?.release_date) {
        const yMatch = track.album.release_date.match(/\d{4}/);
        if (yMatch) year = parseInt(yMatch[0], 10);
      }

      allTracks.push({
        id: track.id || `sp_${allTracks.length}`,
        title: track.name.trim(),
        artist: track.artists
          ? track.artists.map((a: { name: string }) => a.name).join(', ')
          : 'Unknown Artist',
        year,
        audioPreviewUrl: track.preview_url || undefined,
        spotifyUrl:
          track.external_urls?.spotify ||
          `https://open.spotify.com/track/${track.id}`,
      });
    }

    const pageNum = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalTracks / limit);
    log(
      `📦 Pagina ${pageNum}/${totalPages}: ${allTracks.length}/${totalTracks} nummers`,
      allTracks.length
    );

    offset += limit;
  }

  log(
    `🎉 KLAAR! ${allTracks.length} van ${totalTracks} nummers geïmporteerd uit "${playlistName}"!`,
    allTracks.length
  );

  return { name: playlistName, tracks: allTracks };
}
