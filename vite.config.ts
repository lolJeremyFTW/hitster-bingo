// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import puppeteer from 'puppeteer';

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

          const sendLog = (message: string, tracks: any[] = [], isDone = false, isError = false) => {
            res.write(`data: ${JSON.stringify({ message, tracks, count: tracks.length, isDone, isError })}\n\n`);
          };

          try {
            const data = JSON.parse(body);
            const playlistUrl = data.url;

            if (!playlistUrl) {
              sendLog('❌ Fout: Geen Spotify URL opgegeven.', [], true, true);
              res.end();
              return;
            }

            sendLog(`🚀 Browser opstarten voor URL: ${playlistUrl}...`);

            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 900 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            sendLog('🌐 Spotify pagina laden...');
            await page.goto(playlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            const playlistName = await page.evaluate(() => {
              const h1 = document.querySelector('h1');
              return h1 ? h1.innerText.trim() : 'Spotify Playlist';
            });

            sendLog(`🎶 Afspeellijst gedetecteerd: "${playlistName}". Starten met scrolen...`);

            const tracksMap = new Map();
            let previousSize = 0;
            let noChangeCount = 0;

            for (let i = 1; i <= 150; i++) {
              // Extract all currently visible track rows
              const visibleTracks = await page.evaluate(() => {
                const rows = document.querySelectorAll('[data-testid="tracklist-row"], [role="row"], div[aria-rowindex]');
                const results: any[] = [];

                rows.forEach((row) => {
                  const titleEl = row.querySelector('[data-testid="internal-track-link"], a[href*="/track/"], div[dir="auto"]');
                  const artistEls = row.querySelectorAll('a[href*="/artist/"]');

                  if (titleEl) {
                    const title = (titleEl as HTMLElement).innerText.trim();
                    const href = titleEl.getAttribute('href') || '';
                    const trackIdMatch = href.match(/\/track\/([a-zA-Z0-9]+)/);
                    const trackId = trackIdMatch ? trackIdMatch[1] : title;

                    const artists = Array.from(artistEls).map(a => (a as HTMLElement).innerText.trim()).filter(Boolean).join(', ');

                    if (title && title.length > 0 && title !== 'Title' && title !== 'Titel') {
                      results.push({
                        id: trackId,
                        title,
                        artist: artists || 'Unknown Artist',
                        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : undefined
                      });
                    }
                  }
                });

                return results;
              });

              visibleTracks.forEach(t => {
                if (t.title && !tracksMap.has(t.id)) {
                  tracksMap.set(t.id, t);
                }
              });

              const currentTracks = Array.from(tracksMap.values());
              sendLog(`📜 [Scrol ${i}/150] Nummers verzameld: ${tracksMap.size}...`, currentTracks);

              if (tracksMap.size === previousSize) {
                noChangeCount++;
                if (noChangeCount >= 10) {
                  sendLog(`✅ Einde van afspeellijst bereikt! Totaal ${tracksMap.size} nummers.`, currentTracks, true);
                  break;
                }
              } else {
                noChangeCount = 0;
                previousSize = tracksMap.size;
              }

              // Scroll Spotify's main tracklist container directly + keyboard PageDown
              await page.evaluate(() => {
                const mainEl = document.querySelector('main') || 
                               document.querySelector('[data-testid="playlist-tracklist"]')?.parentElement ||
                               document.querySelector('[role="main"]') ||
                               document.documentElement;
                if (mainEl) {
                  mainEl.scrollBy(0, 1000);
                }
                window.scrollBy(0, 1000);
              });

              await page.keyboard.press('PageDown');
              await new Promise(r => setTimeout(r, 450));
            }

            await browser.close();

            const finalTracks = Array.from(tracksMap.values());
            sendLog(`🎉 Crawler Klaar! ${finalTracks.length} nummers succesvol geladen.`, finalTracks, true);
            res.end();
          } catch (err: any) {
            console.error('[Scraper Stream Error]:', err);
            sendLog(`❌ Crawler Fout: ${err.message || 'Scraping mislukt'}`, [], true, true);
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
