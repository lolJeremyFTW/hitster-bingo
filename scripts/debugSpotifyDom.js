import puppeteer from 'puppeteer';

async function debugDom() {
  console.log('Starting Puppeteer DOM debugger...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log('Navigating to playlist...');
  await page.goto('https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3', { waitUntil: 'networkidle2' });

  await new Promise(r => setTimeout(r, 2000));

  const pageTitle = await page.title();
  console.log('Page Title:', pageTitle);

  // Print all elements that look like tracks or links
  const info = await page.evaluate(() => {
    const trackRows = document.querySelectorAll('[data-testid="tracklist-row"]');
    const links = document.querySelectorAll('a[href*="/track/"]');
    const modalOrLogin = document.querySelector('[data-testid="login-button"]') || document.querySelector('iframe');
    
    return {
      trackRowsLength: trackRows.length,
      linksLength: links.length,
      hasLoginPrompt: !!modalOrLogin,
      bodyTextSnippet: document.body.innerText.slice(0, 300)
    };
  });

  console.log('DOM Info:', info);

  // Now inspect network requests made by Spotify page to see API calls
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('spotify.com') && (url.includes('tracks') || url.includes('metadata') || url.includes('graphql') || url.includes('playlist'))) {
      console.log('Network API call intercepted:', url);
    }
  });

  // Scroll 10 times and inspect
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, 1000);
      const main = document.querySelector('main');
      if (main) main.scrollBy(0, 1000);
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const count = await page.evaluate(() => document.querySelectorAll('a[href*="/track/"]').length);
    console.log(`Scroll ${i+1}: Found ${count} track links`);
  }

  await browser.close();
}

debugDom();
