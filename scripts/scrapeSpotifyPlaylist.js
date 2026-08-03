import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export async function scrapeSpotifyPlaylistFullNetwork(playlistUrl, onLog) {
  const log = (msg, count = 0) => {
    console.log(msg);
    if (onLog) onLog(msg, count);
  };

  log(`🚀 Starting Advanced Network Scraper for: ${playlistUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const tracksMap = new Map();

  // Intercept all JSON network responses from Spotify APIs!
  page.on('response', async (res) => {
    const url = res.url();
    if (
      url.includes('api-partner.spotify.com') ||
      url.includes('spclient.wg.spotify.com') ||
      url.includes('open.spotify.com/embed') ||
      url.includes('pathfinder') ||
      url.includes('playlist')
    ) {
      try {
        const text = await res.text();
        if (!text || text.length < 50) return;

        // Recursively extract all track objects from Spotify JSON payloads
        if (text.startsWith('{') || text.startsWith('[')) {
          const json = JSON.parse(text);

          const extractFromObject = (obj) => {
            if (!obj || typeof obj !== 'object') return;

            // Check if object is a Track
            const isTrack = obj.type === 'track' || (obj.name && (obj.artists || obj.subtitle || obj.album));
            if (isTrack && obj.name) {
              const title = obj.name || obj.title;
              let artist = 'Unknown Artist';

              if (Array.isArray(obj.artists)) {
                artist = obj.artists.map((a) => a.name).filter(Boolean).join(', ');
              } else if (typeof obj.subtitle === 'string') {
                artist = obj.subtitle;
              } else if (obj.artists?.items) {
                artist = obj.artists.items.map((a) => a.profile?.name || a.name).filter(Boolean).join(', ');
              }

              let year;
              const relDate = obj.album?.release_date || obj.releaseDate || obj.album?.date;
              if (relDate) {
                const yMatch = String(relDate).match(/\d{4}/);
                if (yMatch) year = parseInt(yMatch[0], 10);
              }

              const trackId = obj.id || obj.uri || title;
              if (title && title.toLowerCase() !== 'title' && !tracksMap.has(trackId)) {
                tracksMap.set(trackId, {
                  id: trackId,
                  title: title.trim(),
                  artist: artist.trim(),
                  year,
                  audioPreviewUrl: obj.preview_url || obj.audioPreview?.url || undefined,
                  spotifyUrl: obj.id ? `https://open.spotify.com/track/${obj.id}` : undefined
                });
                log(`⚡ [Network API] Intercepted: "${title}" by ${artist} (${tracksMap.size} total)`, tracksMap.size);
              }
            }

            if (Array.isArray(obj)) {
              obj.forEach(extractFromObject);
            } else {
              Object.values(obj).forEach(extractFromObject);
            }
          };

          extractFromObject(json);
        }
      } catch (e) {
        // Ignore non-JSON
      }
    }
  });

  log('🌐 Navigating to Spotify Playlist page...');
  await page.goto(playlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  const playlistName = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.innerText.trim() : 'Spotify Playlist';
  });

  log(`🎶 Playlist: "${playlistName}". Auto-scrolling to trigger network pagination...`);

  for (let i = 1; i <= 40; i++) {
    await page.evaluate(() => {
      const main = document.querySelector('main') || document.documentElement;
      main.scrollBy(0, 1200);
      window.scrollBy(0, 1200);
    });
    await page.keyboard.press('PageDown');
    await new Promise(r => setTimeout(r, 600));

    const domTracks = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="tracklist-row"], [role="row"]');
      const res = [];
      rows.forEach(r => {
        const tEl = r.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
        const aEls = r.querySelectorAll('a[href*="/artist/"]');
        if (tEl) {
          const title = tEl.innerText.trim();
          const href = tEl.getAttribute('href') || '';
          const m = href.match(/\/track\/([a-zA-Z0-9]+)/);
          const id = m ? m[1] : title;
          const artist = Array.from(aEls).map(a => a.innerText.trim()).join(', ');
          if (title && title !== 'Title') {
            res.push({ id, title, artist: artist || 'Unknown Artist' });
          }
        }
      });
      return res;
    });

    domTracks.forEach(t => {
      if (!tracksMap.has(t.id)) {
        tracksMap.set(t.id, t);
        log(`📜 [DOM Track] Captured: "${t.title}" (${tracksMap.size} total)`, tracksMap.size);
      }
    });
  }

  await browser.close();

  const finalTracks = Array.from(tracksMap.values());
  log(`🎉 FINISHED! Total tracks intercepted: ${finalTracks.length}`, finalTracks.length);

  return {
    name: playlistName,
    tracks: finalTracks
  };
}

if (process.argv[1] && process.argv[1].endsWith('scrapeSpotifyPlaylist.js')) {
  const url = process.argv[2] || 'https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3';
  scrapeSpotifyPlaylistFullNetwork(url).then(res => {
    const outputPath = path.join(process.cwd(), 'src', 'data', 'myScrapedPlaylist.json');
    fs.writeFileSync(outputPath, JSON.stringify(res, null, 2));
    console.log(`💾 Saved ${res.tracks.length} tracks to ${outputPath}`);
  });
}
