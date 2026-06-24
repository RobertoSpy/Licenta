const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrape() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://mathaus.ro/p/bca-elpreco-izopor-650-x-300-x-200-mm/000000000010405212', { waitUntil: 'networkidle2' });
  const rawPrice = await page.evaluate(() => {
    const sel = ['.price-new', '.product-price .price', '[class*="productPrice"]', '[itemprop="price"]', '.price-box .price', '.special-price .price', '.regular-price .price'];
    let rawPrice = '';
    for (const s of sel) {
      const el = document.querySelector(s);
      if (el) {
        rawPrice = el.innerHTML;
        break;
      }
    }
    return rawPrice;
  });
  console.log('RAW_PRICE:', rawPrice);
  await browser.close();
}
scrape();
