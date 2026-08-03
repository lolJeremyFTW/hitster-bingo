// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Spotify API Proxy Plugin
 * 
 * Provides two server-side endpoints that proxy Spotify Web API calls,
 * avoiding CORS issues. No Puppeteer, no browser scraping.
 * 
 * POST /api/spotify-token  — Exchange client credentials for access token
 * POST /api/spotify-playlist — Fetch all tracks from a playlist (paginated)
 */
function spotifyApiPlugin() {
  return {
    name: 'spotify-api-plugin',
    configureServer(server: any) {

      // Helper to read POST body
      const readBody = (req: any): Promise<string> => new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => resolve(body));
      });

      // Endpoint: Get access token (proxied to avoid CORS)
      server.middlewares.use('/api/spotify-token', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }

        const body = await readBody(req);
        const { clientId, clientSecret } = JSON.parse(body);

        try {
          const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            },
            body: new URLSearchParams({ grant_type: 'client_credentials' })
          });

          const data = await tokenRes.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Endpoint: Fetch ALL playlist tracks via SSE stream
      server.middlewares.use('/api/scrape-playlist-stream', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }

        const body = await readBody(req);
        const { url, clientId, clientSecret } = JSON.parse(body);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const send = (message: string, count = 0, isDone = false, isError = false, tracks: any[] = []) => {
          res.write(`data: ${JSON.stringify({ message, count, isDone, isError, tracks })}\n\n`);
        };

        try {
          // Extract playlist ID
          const match = url.match(/playlist[\/:]([ a-zA-Z0-9]{22})/);
          const playlistId = match ? match[1] : url.trim();
          if (!playlistId || playlistId.length < 10) {
            send('❌ Ongeldige Spotify URL', 0, true, true);
            res.end();
            return;
          }

          // Get access token
          let accessToken: string | null = null;

          if (clientId && clientSecret) {
            send('🔑 Authenticeren met je Spotify API credentials...');
            try {
              const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
                },
                body: new URLSearchParams({ grant_type: 'client_credentials' })
              });
              if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                accessToken = tokenData.access_token;
                send('✅ API token verkregen!');
              } else {
                send(`⚠️ Credentials fout (${tokenRes.status}). Probeer anoniem token...`);
              }
            } catch (e: any) {
              send(`⚠️ Token request mislukt: ${e.message}`);
            }
          }

          // Try anonymous token
          if (!accessToken) {
            send('🔓 Anoniem Spotify token ophalen...');
            try {
              const anonRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              if (anonRes.ok) {
                const anonData = await anonRes.json();
                if (anonData.accessToken) {
                  accessToken = anonData.accessToken;
                  send('✅ Anoniem token verkregen!');
                }
              }
            } catch {
              // Fall through
            }
          }

          if (!accessToken) {
            send('❌ Kan geen Spotify token krijgen. Voer je Spotify API Client ID & Secret in (gratis op developer.spotify.com/dashboard).', 0, true, true);
            res.end();
            return;
          }

          // Get playlist metadata
          send(`🎵 Playlist metadata ophalen...`);
          const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.total`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!metaRes.ok) {
            send(`❌ Kan playlist niet laden (${metaRes.status}). Is de playlist openbaar?`, 0, true, true);
            res.end();
            return;
          }

          const meta = await metaRes.json();
          const playlistName = meta.name || 'Spotify Playlist';
          const totalTracks = meta.tracks?.total || 0;

          send(`🎶 "${playlistName}" — ${totalTracks} nummers gevonden! Ophalen...`);

          // Paginate through ALL tracks
          const allTracks: any[] = [];
          let offset = 0;
          const limit = 100;

          while (offset < totalTracks) {
            const pageUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists(name),album(name,release_date),preview_url,external_urls))`;
            
            const pageRes = await fetch(pageUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!pageRes.ok) {
              send(`⚠️ Pagina ${Math.floor(offset / limit) + 1} mislukt (${pageRes.status})`);
              break;
            }

            const pageData = await pageRes.json();
            const items = pageData.items || [];
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
                artist: track.artists ? track.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist',
                year,
                audioPreviewUrl: track.preview_url || undefined,
                spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
              });
            }

            const pageNum = Math.floor(offset / limit) + 1;
            const totalPages = Math.ceil(totalTracks / limit);
            send(`📦 Pagina ${pageNum}/${totalPages}: ${allTracks.length}/${totalTracks} nummers opgehaald`, allTracks.length);
            
            offset += limit;
          }

          if (allTracks.length > 0) {
            send(`🎉 KLAAR! ${allTracks.length} van ${totalTracks} nummers succesvol geïmporteerd uit "${playlistName}"!`, allTracks.length, true, false, allTracks);
          } else {
            send('❌ Geen nummers gevonden.', 0, true, true);
          }

          res.end();
        } catch (err: any) {
          console.error('[Spotify API Error]:', err);
          send(`❌ Fout: ${err.message || 'Import mislukt'}`, 0, true, true);
          res.end();
        }
      });

      // Endpoint: Fetch tracks from Spotify embed page (NO credentials needed, ~100 tracks max)
      server.middlewares.use('/api/spotify-embed', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }

        const body = await readBody(req);
        const { url } = JSON.parse(body);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const send = (message: string, count = 0, isDone = false, isError = false, tracks: any[] = []) => {
          res.write(`data: ${JSON.stringify({ message, count, isDone, isError, tracks })}\n\n`);
        };

        try {
          const match = url.match(/playlist[\/:]([ a-zA-Z0-9]{22})/);
          const playlistId = match ? match[1] : url.trim();
          if (!playlistId || playlistId.length < 10) {
            send('❌ Ongeldige Spotify URL', 0, true, true);
            res.end();
            return;
          }

          send('🔓 Spotify embed pagina ophalen (geen login nodig)...');

          // Fetch the embed page HTML server-side (no CORS issues)
          const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
          const embedRes = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
            }
          });

          if (!embedRes.ok) {
            send(`❌ Spotify embed niet beschikbaar (${embedRes.status}). Is de playlist openbaar?`, 0, true, true);
            res.end();
            return;
          }

          const html = await embedRes.text();
          send(`📄 Embed pagina ontvangen (${(html.length / 1024).toFixed(0)} KB), tracks extraheren...`);

          // Extract JSON data from embedded script tags
          const jsonPatterns = [
            /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
            /<script id="resource" type="application\/json">(.*?)<\/script>/s,
            /<script id="initial-state" type="application\/json">(.*?)<\/script>/s,
          ];

          let tracks: any[] = [];
          let playlistName = 'Spotify Playlist';

          for (const pattern of jsonPatterns) {
            const match = html.match(pattern);
            if (!match || !match[1]) continue;

            try {
              const payload = JSON.parse(match[1]);

              // Recursively find track-like objects in the JSON tree
              const extractTracks = (obj: any, depth = 0): void => {
                if (!obj || typeof obj !== 'object' || depth > 15) return;

                // Check for playlist name
                if (obj.name && obj.type === 'playlist') {
                  playlistName = obj.name;
                }

                // Check if this looks like a track
                if (obj.name && (obj.artists || obj.subtitle || obj.type === 'track') && obj.type !== 'playlist') {
                  const title = obj.name;
                  let artist = 'Unknown Artist';
                  if (Array.isArray(obj.artists)) {
                    artist = obj.artists.map((a: any) => a.name || a).filter(Boolean).join(', ');
                  } else if (obj.subtitle) {
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
                  if (obj.uri?.includes('spotify:track:')) {
                    trackId = obj.uri.split('spotify:track:')[1];
                  }

                  if (title && title.toLowerCase() !== 'title' && trackId) {
                    // Deduplicate by id
                    if (!tracks.some(t => t.id === trackId)) {
                      tracks.push({
                        id: trackId,
                        title: title.trim(),
                        artist: artist.trim(),
                        year,
                        audioPreviewUrl: obj.audioPreview?.url || obj.preview_url || undefined,
                        spotifyUrl: `https://open.spotify.com/track/${trackId}`
                      });
                    }
                  }
                }

                // Recurse
                if (Array.isArray(obj)) {
                  obj.forEach(item => extractTracks(item, depth + 1));
                } else {
                  Object.values(obj).forEach(val => extractTracks(val, depth + 1));
                }
              };

              extractTracks(payload);
              if (tracks.length > 0) break;
            } catch {
              // Parse failed, try next pattern
            }
          }

          if (tracks.length > 0) {
            send(`🎉 ${tracks.length} nummers gevonden uit "${playlistName}" (embed, zonder login)!`, tracks.length, true, false, tracks);
          } else {
            send('❌ Geen nummers gevonden in de embed pagina. Probeer OAuth login voor 800+ nummers.', 0, true, true);
          }

          res.end();
        } catch (err: any) {
          console.error('[Embed scrape error]:', err);
          send(`❌ Fout: ${err.message}`, 0, true, true);
          res.end();
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    spotifyApiPlugin()
  ],
});
