// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import puppeteer from 'puppeteer';

function spotifyScraperPlugin() {
  return {
    name: 'spotify-scraper-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/scrape-playlist', async (req: any, res: any) => {
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
          try {
            const data = JSON.parse(body);
            const playlistUrl = data.url;

            if (!playlistUrl) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing playlist URL' }));
              return;
            }

            console.log('[Scraper API] Starting Puppeteer scraper for:', playlistUrl);

            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 900 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto(playlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            const playlistName = await page.evaluate(() => {
              const h1 = document.querySelector('h1');
              return h1 ? h1.innerText.trim() : 'Spotify Playlist';
            });

            const tracksMap = new Map();
            let previousSize = 0;
            let noChangeCount = 0;

            for (let i = 0; i < 80; i++) {
              const visibleTracks = await page.evaluate(() => {
                const rows = document.querySelectorAll('[data-testid="tracklist-row"], [role="row"]');
                const results: any[] = [];

                rows.forEach((row) => {
                  const titleEl = row.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
                  const artistEls = row.querySelectorAll('a[href*="/artist/"]');

                  if (titleEl) {
                    const title = (titleEl as HTMLElement).innerText.trim();
                    const href = titleEl.getAttribute('href') || '';
                    const trackIdMatch = href.match(/\/track\/([a-zA-Z0-9]+)/);
                    const trackId = trackIdMatch ? trackIdMatch[1] : title;

                    const artists = Array.from(artistEls).map(a => (a as HTMLElement).innerText.trim()).filter(Boolean).join(', ');

                    results.push({
                      id: trackId,
                      title,
                      artist: artists || 'Unknown Artist',
                      spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : undefined
                    });
                  }
                });

                return results;
              });

              visibleTracks.forEach(t => {
                if (t.title && !tracksMap.has(t.id)) {
                  tracksMap.set(t.id, t);
                }
              });

              if (tracksMap.size === previousSize) {
                noChangeCount++;
                if (noChangeCount >= 6) break;
              } else {
                noChangeCount = 0;
                previousSize = tracksMap.size;
              }

              await page.evaluate(() => {
                window.scrollBy(0, 900);
              });

              await new Promise(r => setTimeout(r, 400));
            }

            await browser.close();

            const finalTracks = Array.from(tracksMap.values());
            console.log(`[Scraper API] Successfully scraped ${finalTracks.length} tracks!`);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              name: playlistName,
              tracks: finalTracks
            }));
          } catch (err: any) {
            console.error('[Scraper API Error]:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || 'Scraping failed' }));
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
