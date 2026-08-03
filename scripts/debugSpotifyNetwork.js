import puppeteer from 'puppeteer';

async function debugNetwork() {
  console.log('Starting Network Interceptor for Spotify Web Player...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api-partner.spotify.com') || url.includes('pathfinder') || url.includes('playlist')) {
      console.log(`[API Response] ${res.status()} -> ${url.slice(0, 100)}...`);
      try {
        const text = await res.text();
        if (text.includes('track') || text.includes('items') || text.includes('content')) {
          console.log(`FOUND TRACK CONTENT! JSON length: ${text.length}`);
        }
      } catch {}
    }
  });

  console.log('Navigating to playlist...');
  await page.goto('https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3', { waitUntil: 'networkidle2' });

  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
}

debugNetwork();
