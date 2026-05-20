import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (error: any) => console.error('PAGE ERROR:', error?.message || error));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  try {
    await page.goto('http://frontend:5173/editor/1', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Timeout reached or page failed to load.');
  }
  
  await browser.close();
})();
