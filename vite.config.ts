// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { scrapeSpotifyPlaylistFullNetwork } from './scripts/scrapeSpotifyPlaylist.js';

function spotifyScraperPlugin() {
  return {
    name: 'spotify-scraper-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/scrape-playlist-stream', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });

        req.on('end', async () => {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const sendLog = (message: string, count: number = 0, isDone = false, isError = false, tracks: any[] = []) => {
            res.write(`data: ${JSON.stringify({ message, count, isDone, isError, tracks })}\n\n`);
          };

          try {
            const data = JSON.parse(body);
            const playlistUrl = data.url;

            if (!playlistUrl) {
              sendLog('❌ Fout: Geen Spotify URL opgegeven.', 0, true, true);
              res.end();
              return;
            }

            sendLog(`🚀 Netwerk Interceptor Scraper starten voor URL...`, 0);

            const result = await scrapeSpotifyPlaylistFullNetwork(playlistUrl, (msg, count) => {
              sendLog(msg, count);
            });

            if (result && result.tracks && result.tracks.length > 0) {
              sendLog(`🎉 Crawler Voltooid! Totaal ${result.tracks.length} nummers ingeladen uit "${result.name}"!`, result.tracks.length, true, false, result.tracks);
            } else {
              sendLog('❌ Geen nummers onderschept.', 0, true, true);
            }

            res.end();
          } catch (err: any) {
            console.error('[Scraper Stream Error]:', err);
            sendLog(`❌ Scraper Fout: ${err.message || 'Scraping mislukt'}`, 0, true, true);
            res.end();
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    spotifyScraperPlugin()
  ],
});
