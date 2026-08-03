import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function scrapeSpotifyPlaylist(playlistUrl) {
  console.log('🚀 Starting Spotify Playlist Scraper for:', playlistUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('🌐 Loading Spotify Playlist page...');
  await page.goto(playlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // Extract Playlist Name
  const playlistName = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.innerText.trim() : 'Spotify Playlist';
  });

  console.log(`🎶 Playlist Name: "${playlistName}". Scrolling to load ALL 800+ tracks...`);

  // Scroll down repeatedly to load virtualized list items
  const tracksMap = new Map();
  let previousSize = 0;
  let noChangeCount = 0;

  for (let i = 0; i < 150; i++) {
    // Extract current visible tracks
    const visibleTracks = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="tracklist-row"], [role="row"]');
      const results = [];

      rows.forEach((row) => {
        const titleEl = row.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
        const artistEls = row.querySelectorAll('a[href*="/artist/"]');
        
        if (titleEl) {
          const title = titleEl.innerText.trim();
          const href = titleEl.getAttribute('href') || '';
          const trackIdMatch = href.match(/\/track\/([a-zA-Z0-9]+)/);
          const trackId = trackIdMatch ? trackIdMatch[1] : title;

          const artists = Array.from(artistEls).map(a => a.innerText.trim()).filter(Boolean).join(', ');

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

    console.log(`[Scroll ${i + 1}] Captured ${tracksMap.size} tracks so far...`);

    if (tracksMap.size === previousSize) {
      noChangeCount++;
      if (noChangeCount >= 8) {
        console.log('✅ Reached end of playlist or all tracks loaded!');
        break;
      }
    } else {
      noChangeCount = 0;
      previousSize = tracksMap.size;
    }

    // Scroll down by 800px
    await page.evaluate(() => {
      window.scrollBy(0, 800);
    });

    await new Promise(r => setTimeout(r, 600));
  }

  await browser.close();

  const finalTracks = Array.from(tracksMap.values());
  console.log(`🎉 FINISHED! Total tracks scraped: ${finalTracks.length}`);

  const outputData = {
    id: `scraped_${Date.now()}`,
    name: playlistName,
    description: `Volledig gecrawld met local scraper (${finalTracks.length} nummers)`,
    createdAt: new Date().toISOString(),
    tracks: finalTracks
  };

  const outputPath = path.join(process.cwd(), 'src', 'data', 'myScrapedPlaylist.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`💾 Saved all ${finalTracks.length} tracks to: ${outputPath}`);
}

const urlArg = process.argv[2] || 'https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3';
scrapeSpotifyPlaylist(urlArg);
