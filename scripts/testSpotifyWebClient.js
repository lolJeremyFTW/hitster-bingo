import puppeteer from 'puppeteer';

async function getSpotifyTokenAndTracks(playlistId) {
  console.log('🚀 Starting Spotify Web Token & Track Extractor for playlist:', playlistId);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let accessToken = null;
  let clientToken = null;

  // Intercept network requests to capture Spotify's bearer token!
  page.on('request', req => {
    const headers = req.headers();
    if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
      accessToken = headers['authorization'].split('Bearer ')[1];
      console.log('🔑 Intercepted Spotify Web Bearer Token!');
    }
    if (headers['client-token']) {
      clientToken = headers['client-token'];
    }
  });

  console.log('🌐 Opening Spotify Web Player...');
  await page.goto(`https://open.spotify.com/playlist/${playlistId}`, { waitUntil: 'networkidle2' });

  await new Promise(r => setTimeout(r, 2500));

  console.log('Token captured:', accessToken ? 'YES!' : 'NO');

  if (accessToken) {
    console.log('Paging through ALL 800+ tracks via Spotify API...');
    let offset = 0;
    const limit = 100;
    let allTracks = [];

    while (offset < 2000) {
      const apiUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`;
      const res = await page.evaluate(async (url, token) => {
        const r = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!r.ok) return null;
        return await r.json();
      }, apiUrl, accessToken);

      if (!res || !res.items || res.items.length === 0) {
        console.log(`Finished or failed at offset ${offset}`);
        break;
      }

      res.items.forEach(item => {
        if (item.track && item.track.name) {
          const year = item.track.album?.release_date ? parseInt(item.track.album.release_date.slice(0, 4), 10) : undefined;
          allTracks.push({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            year: year,
            audioPreviewUrl: item.track.preview_url,
            spotifyUrl: `https://open.spotify.com/track/${item.track.id}`
          });
        }
      });

      console.log(`Fetched offset ${offset}: +${res.items.length} tracks (Total: ${allTracks.length} / ${res.total})`);

      if (allTracks.length >= res.total) {
        break;
      }

      offset += limit;
    }

    console.log(`🎉 SUCCESS! Captured ALL ${allTracks.length} tracks from playlist!`);
  }

  await browser.close();
}

getSpotifyTokenAndTracks('5zSKBda7QTnWMHecVs20E3');
