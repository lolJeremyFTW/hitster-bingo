/**
 * Spotify OAuth PKCE (Proof Key for Code Exchange) Module
 *
 * Implements the Authorization Code with PKCE flow for Spotify.
 * No client_secret needed — just a Client ID.
 *
 * Belangrijk (stand van zaken sinds Spotify's API-wijzigingen van 27-11-2024):
 * - Apps in Development Mode krijgen GEEN `preview_url` meer. Audio loopt
 *   daarom via de Web Playback SDK (zie spotifyPlayer.ts), niet via <audio>.
 * - Spotify-eigen/algoritmische playlists (editorial, Discover Weekly, Top 50)
 *   geven 404. Alleen playlists die een echte gebruiker heeft gemaakt werken.
 * - `localhost` is verboden als redirect URI — alleen de expliciete loopback
 *   `http://127.0.0.1:PORT`. Zie ensureLoopbackOrigin().
 */

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Scopes:
 * - playlist-read-private/collaborative → playlists importeren
 * - streaming + user-read-email + user-read-private → Web Playback SDK (Premium)
 * - user-modify-playback-state + user-read-playback-state → fragment starten/pauzeren
 */
const REQUIRED_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
];

const SCOPES = REQUIRED_SCOPES.join(' ');

/**
 * Jeremy's eigen Spotify-app, standaard ingebakken zodat inloggen op elk
 * toestel één klik is. Publiek gegeven bij PKCE — hij staat toch in elke
 * auth-URL, er bestaat geen secret in deze flow. Een zelf ingevulde Client ID
 * (localStorage) wint altijd van deze standaard.
 *
 * Let op: de app staat in Development Mode, dus alleen Spotify-accounts die in
 * het dashboard onder User Management staan kunnen ermee inloggen.
 */
export const DEFAULT_CLIENT_ID = '63903f0944814b91aacb4b712d0e4b66';

// Storage keys
const STORAGE_KEYS = {
  CLIENT_ID: 'hitster_sp_client_id',
  ACCESS_TOKEN: 'hitster_sp_access_token',
  REFRESH_TOKEN: 'hitster_sp_refresh_token',
  TOKEN_EXPIRY: 'hitster_sp_token_expiry',
  CODE_VERIFIER: 'hitster_sp_code_verifier',
  GRANTED_SCOPES: 'hitster_sp_granted_scopes',
} as const;

/**
 * Spotify weigert `localhost` als redirect URI. Draaien we daarop, dan is de
 * hele OAuth-flow kansloos — ongeacht wat er in het dashboard staat.
 * Geeft true terug als de pagina wordt herladen op de loopback-variant.
 */
export function ensureLoopbackOrigin(): boolean {
  if (window.location.hostname === 'localhost') {
    const fixed = window.location.href.replace('//localhost', '//127.0.0.1');
    window.location.replace(fixed);
    return true;
  }
  return false;
}

export function isLocalhostOrigin(): boolean {
  return window.location.hostname === 'localhost';
}

/**
 * De exacte redirect URI die in het Spotify dashboard moet staan.
 * Altijd zonder trailing slash — Spotify matcht letterlijk.
 */
export function getRedirectUri(): string {
  return window.location.origin.replace('//localhost', '//127.0.0.1').replace(/\/+$/, '');
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return window.crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Start de OAuth PKCE flow — stuurt de browser naar Spotify's inlogpagina.
 */
export async function initiateSpotifyLogin(clientId: string): Promise<void> {
  if (!clientId.trim()) {
    throw new Error('Client ID is vereist');
  }

  if (isLocalhostOrigin()) {
    throw new Error(
      'Spotify accepteert "localhost" niet als redirect URI. Open de app op ' +
      `http://127.0.0.1:${window.location.port || '5173'} en probeer opnieuw.`
    );
  }

  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());

  const codeVerifier = generateRandomString(64);
  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

  const codeChallenge = base64urlEncode(await sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId.trim(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: getRedirectUri(),
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Wisselt de authorization code in voor tokens. Aanroepen bij page load.
 */
export async function handleSpotifyCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    console.error('[Spotify OAuth] Auth error:', error);
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }

  if (!code) return false;

  const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  const clientId = getStoredClientId();

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
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error_description || errData.error || 'Token exchange failed');
    }

    const data = await response.json();

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + data.expires_in * 1000));
    // Vastleggen wat Spotify écht heeft toegekend. Een token dat vóór een
    // scope-uitbreiding is uitgegeven blijft geldig maar mist rechten, en
    // refreshen herstelt dat niet — dan is opnieuw inloggen de enige weg.
    localStorage.setItem(STORAGE_KEYS.GRANTED_SCOPES, data.scope || '');

    window.history.replaceState({}, document.title, window.location.pathname);

    console.log('[Spotify OAuth] Successfully authenticated!');
    return true;
  } catch (err) {
    console.error('[Spotify OAuth] Token exchange error:', err);
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const clientId = getStoredClientId();

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
    if (data.scope !== undefined) {
      localStorage.setItem(STORAGE_KEYS.GRANTED_SCOPES, data.scope || '');
    }

    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Scopes die de app nodig heeft maar die het huidige token niet heeft.
 *
 * Dit gebeurt zodra de app een scope toevoegt: bestaande tokens blijven geldig
 * en refreshen levert dezelfde beperkte rechten op. Spotify antwoordt dan met
 * 401 "Permissions missing" op bijvoorbeeld /me/player/play. De enige oplossing
 * is de gebruiker opnieuw door de autorisatie sturen.
 */
export function getMissingScopes(): string[] {
  if (!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return [];

  const granted = localStorage.getItem(STORAGE_KEYS.GRANTED_SCOPES);
  // Ingelogd vóórdat we scopes bijhielden — we weten het niet, dus
  // behandelen als "mist rechten" zodat de gebruiker opnieuw inlogt.
  if (granted === null) return REQUIRED_SCOPES;

  const grantedSet = new Set(granted.split(/\s+/).filter(Boolean));
  return REQUIRED_SCOPES.filter(s => !grantedSet.has(s));
}

export function hasAllRequiredScopes(): boolean {
  return getMissingScopes().length === 0;
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

  if (!token) return null;

  // 60s buffer zodat een lopend verzoek niet halverwege verloopt
  if (expiry && Date.now() > parseInt(expiry, 10) - 60000) {
    return refreshAccessToken();
  }

  return token;
}

export function isSpotifyAuthenticated(): boolean {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry, 10);
}

export function getStoredClientId(): string {
  return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || DEFAULT_CLIENT_ID;
}

export function logoutSpotify(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  localStorage.removeItem(STORAGE_KEYS.GRANTED_SCOPES);
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
  product: string; // 'premium' | 'free' | 'open'
  isPremium: boolean;
}

/**
 * Haalt het profiel op — nodig om te weten of de Web Playback SDK bruikbaar is.
 */
export async function fetchSpotifyProfile(): Promise<SpotifyProfile | null> {
  const token = await getValidAccessToken();
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    displayName: data.display_name || data.id,
    product: data.product || 'unknown',
    isPremium: data.product === 'premium',
  };
}

/**
 * Zoekt voor tracks zonder speelbare Spotify-URI het juiste nummer op.
 *
 * Nodig voor het standaard-deck en voor lijsten die als tekst zijn geplakt:
 * die hebben wel titel/artiest, maar geen URI — en zonder URI kan de Web
 * Playback SDK niets afspelen.
 */
export async function matchTracksToSpotify(
  tracks: import('../types/hitster').CustomTrack[],
  onProgress?: (message: string, done: number, total: number) => void
): Promise<{ tracks: import('../types/hitster').CustomTrack[]; matchedCount: number }> {
  const missing = tracks.filter(t => !t.spotifyUri);
  if (missing.length === 0) return { tracks, matchedCount: 0 };

  const token = await getValidAccessToken();
  if (!token) {
    onProgress?.('⚠️ Log in met Spotify om nummers koppelbaar te maken.', 0, missing.length);
    return { tracks, matchedCount: 0 };
  }

  onProgress?.(`🔗 ${missing.length} nummers koppelen aan Spotify...`, 0, missing.length);

  const matches = new Map<string, { uri: string; url: string; year?: number; album?: string; durationMs?: number }>();
  let done = 0;

  for (const track of missing) {
    // track:/artist: velden geven veel preciezere treffers dan losse woorden
    const q = `track:${track.title.replace(/["]/g, '')} artist:${track.artist.split(/,|&/)[0].replace(/["]/g, '')}`;
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1&market=from_token`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        const hit = data.tracks?.items?.[0];
        if (hit?.uri) {
          let year: number | undefined;
          const rd: string | undefined = hit.album?.release_date;
          if (rd) {
            const m = rd.match(/\d{4}/);
            if (m) year = parseInt(m[0], 10);
          }
          matches.set(track.id, {
            uri: hit.uri,
            url: hit.external_urls?.spotify || `https://open.spotify.com/track/${hit.id}`,
            year,
            album: hit.album?.name,
            durationMs: typeof hit.duration_ms === 'number' ? hit.duration_ms : undefined,
          });
        }
      }
    } catch {
      // Deze track slaan we over; de rest gaat gewoon door
    }

    done++;
    if (done % 10 === 0 || done === missing.length) {
      onProgress?.(`🔗 ${done}/${missing.length} gekoppeld (${matches.size} gevonden)...`, done, missing.length);
    }
  }

  const updated = tracks.map(t => {
    const m = matches.get(t.id);
    if (!m) return t;
    return {
      ...t,
      spotifyUri: m.uri,
      spotifyUrl: m.url,
      // Bestaand jaartal niet overschrijven — dat kan al gecorrigeerd zijn
      year: t.year ?? m.year,
      albumName: t.albumName ?? m.album,
      durationMs: t.durationMs ?? m.durationMs,
    };
  });

  onProgress?.(`✅ ${matches.size} van ${missing.length} nummers gekoppeld en afspeelbaar.`, done, missing.length);

  return { tracks: updated, matchedCount: matches.size };
}

export function extractPlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/playlist[/:]([a-zA-Z0-9]{22})/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Haalt ALLE tracks uit een playlist op via de OAuth-token van de gebruiker.
 *
 * Pagineert door `next` te volgen — dat is de URL die Spotify zelf teruggeeft,
 * inclusief de juiste limit/offset. Betrouwbaarder dan zelf offsets rekenen op
 * basis van `tracks.total`, wat bij lokale bestanden en verwijderde nummers
 * niet klopt.
 *
 * Gebruikt het nieuwe /items endpoint (het oude /tracks is deprecated) en valt
 * terug op /tracks als /items niet beschikbaar is. In de response heet het veld
 * `item`; vroeger was dat `track` — beide worden gelezen.
 */
export async function fetchPlaylistTracksWithOAuth(
  playlistUrl: string,
  onLog?: (message: string, count: number) => void
): Promise<{ name: string; tracks: import('../types/hitster').CustomTrack[] } | null> {
  const log = (msg: string, count = 0) => onLog?.(msg, count);

  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    log('❌ Ongeldige Spotify playlist URL');
    throw new Error(
      'Ongeldige Spotify playlist URL. Plak de link uit Spotify → Delen → Link naar playlist kopiëren.'
    );
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    log('❌ Niet ingelogd bij Spotify.');
    throw new Error('Niet ingelogd bij Spotify. Klik op "Login met Spotify".');
  }

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  log(`🎵 Playlist ${playlistId} ophalen...`);

  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: authHeader,
  });

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        logoutSpotify();
        log('❌ Spotify sessie verlopen. Log opnieuw in.');
        throw new Error('Spotify sessie verlopen. Log opnieuw in met Spotify.');
      }
      return fetchPlaylistTracksWithOAuth(playlistUrl, onLog);
    }

    if (metaRes.status === 404) {
      log('❌ Playlist niet gevonden (404).');
      throw new Error(
        'Playlist niet gevonden (404). Dit is bijna altijd een playlist die Spotify zelf ' +
        'heeft gemaakt (editorial of algoritmisch, zoals Top 50, This Is… of Discover Weekly). ' +
        'Die zijn sinds 27-11-2024 geblokkeerd voor apps in Development Mode.\n\n' +
        'Oplossing: open de playlist in Spotify, selecteer alle nummers (Ctrl+A), ' +
        'rechtermuisknop → "Toevoegen aan afspeellijst" → nieuwe eigen playlist. ' +
        'Importeer daarna die eigen playlist.'
      );
    }

    if (metaRes.status === 403) {
      log('❌ Geen toegang tot playlist (403).');
      throw new Error(
        'Geen toegang (403). Controleer in het Spotify Developer Dashboard onder ' +
        '"User Management" of dit Spotify-account is toegevoegd aan je app.'
      );
    }

    const errText = await metaRes.text().catch(() => '');
    log(`❌ Spotify API fout (${metaRes.status}): ${errText}`);
    throw new Error(`Spotify API fout (${metaRes.status}). ${errText}`);
  }

  const meta = await metaRes.json();
  const playlistName = meta.name || 'Spotify Playlist';
  const totalTracks: number = meta.tracks?.total ?? 0;

  log(`🎶 "${playlistName}" — ${totalTracks} nummers gevonden! Ophalen...`);

  const allTracks: import('../types/hitster').CustomTrack[] = [];
  const seenIds = new Set<string>();
  let skippedLocal = 0;

  const fields =
    'next,total,items(is_local,item(id,name,uri,duration_ms,artists(name),album(name,release_date,release_date_precision),external_urls))';

  // /items is de opvolger van het deprecated /tracks endpoint
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/items` +
    `?limit=50&market=from_token&additional_types=track&fields=${encodeURIComponent(fields)}`;
  let usingLegacyEndpoint = false;

  while (nextUrl) {
    let res: Response = await fetch(nextUrl, { headers: authHeader });

    // Niet elk account/regio heeft /items al; val één keer terug op /tracks
    if (!res.ok && res.status === 404 && !usingLegacyEndpoint && allTracks.length === 0) {
      usingLegacyEndpoint = true;
      log('ℹ️ /items niet beschikbaar, terugvallen op /tracks...');
      nextUrl =
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks` +
        `?limit=100&market=from_token&additional_types=track`;
      res = await fetch(nextUrl, { headers: authHeader });
    }

    if (!res.ok) {
      if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) return fetchPlaylistTracksWithOAuth(playlistUrl, onLog);
      }
      const errText = await res.text().catch(() => '');
      log(`⚠️ Pagina mislukt (${res.status}). ${allTracks.length} nummers opgehaald.`);
      if (allTracks.length === 0) {
        throw new Error(`Spotify API fout bij ophalen nummers (${res.status}). ${errText}`);
      }
      break;
    }

    const data = await res.json();
    const items: any[] = data.items || [];
    if (items.length === 0) break;

    for (const entry of items) {
      // Lokale bestanden zijn niet streambaar en hebben geen bruikbare metadata
      if (entry.is_local) {
        skippedLocal++;
        continue;
      }

      const track = entry.item ?? entry.track;
      if (!track || !track.name || !track.id) continue;
      if (seenIds.has(track.id)) continue;
      seenIds.add(track.id);

      let year: number | undefined;
      const releaseDate: string | undefined = track.album?.release_date;
      if (releaseDate) {
        const yMatch = releaseDate.match(/\d{4}/);
        if (yMatch) year = parseInt(yMatch[0], 10);
      }

      allTracks.push({
        id: track.id,
        title: track.name.trim(),
        artist: Array.isArray(track.artists)
          ? track.artists.map((a: { name: string }) => a.name).join(', ')
          : 'Unknown Artist',
        year,
        yearSource: year ? 'spotify' : undefined,
        albumName: track.album?.name,
        durationMs: typeof track.duration_ms === 'number' ? track.duration_ms : undefined,
        spotifyUri: track.uri || `spotify:track:${track.id}`,
        spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      });
    }

    log(`📦 ${allTracks.length}/${totalTracks} nummers opgehaald...`, allTracks.length);

    nextUrl = data.next || null;
  }

  if (skippedLocal > 0) {
    log(`ℹ️ ${skippedLocal} lokale bestanden overgeslagen (niet afspeelbaar via Spotify).`);
  }

  if (allTracks.length === 0) {
    throw new Error(
      'Geen nummers gevonden in deze playlist. Bevat hij alleen lokale bestanden of podcasts?'
    );
  }

  const missingYear = allTracks.filter(t => !t.year).length;
  if (missingYear > 0) {
    log(`⚠️ ${missingYear} nummers zonder jaartal — die vul ik aan via MusicBrainz.`);
  }

  log(
    `🎉 KLAAR! ${allTracks.length} nummers geïmporteerd uit "${playlistName}"!`,
    allTracks.length
  );

  return { name: playlistName, tracks: allTracks };
}
