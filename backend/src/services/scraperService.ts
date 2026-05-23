import puppeteer from 'puppeteer';

export interface ScrapedMaterial {
  name: string;
  pricePerUnit: number;
  storeUrl: string;
}

export class ScraperService {
  /**
   * Extrage o listă de produse (nume, preț, link) de pe o pagină de categorie Dedeman
   */
  async scrapeCategory(url: string, limit: number = 5): Promise<ScrapedMaterial[]> {
    console.log(`Lansare Puppeteer pentru scraping URL: ${url}`);
    
    // Configurăm browserul în mod headless pentru a rula invizibil în fundal
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Mimăm un browser real pentru a evita blocajele de scraping
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Căutăm elementele de produs de pe Dedeman. 
      // Atenție: selectorii pot varia, trebuie adaptați la DOM-ul curent
      const products = await page.evaluate((maxLimit) => {
        const results: ScrapedMaterial[] = [];
        
        // Selectăm toate grid-urile de produse (ajustabil conform Dedeman DOM)
        // Mai jos este o încercare generică de selectori
        const items = document.querySelectorAll('.product-item, .item, .product-thumb, [data-layer="product"]');
        
        for (let i = 0; i < items.length && results.length < maxLimit; i++) {
          const item = items[i];
          
          // Extragem numele
          const nameEl = item.querySelector('.product-name, .name, h3, a[title]');
          let name = nameEl?.textContent?.trim() || nameEl?.getAttribute('title');
          
          // Extragem prețul
          const priceEl = item.querySelector('.price, .special-price, .regular-price');
          let priceText = priceEl?.textContent?.trim();
          
          // Extragem URL-ul
          const linkEl = item.querySelector('a') as HTMLAnchorElement;
          const storeUrl = linkEl?.href;

          if (name && priceText && storeUrl) {
            // Curățăm prețul (ex: "85,50 lei" -> 85.5)
            priceText = priceText.replace(/[^\d.,]/g, '').replace(',', '.');
            const price = parseFloat(priceText);
            
            if (!isNaN(price) && price > 0) {
              results.push({ name, pricePerUnit: price, storeUrl });
            }
          }
        }
        
        return results;
      }, limit);

      console.log(`S-au extras ${products.length} produse din pagină.`);
      return products;
    } catch (error) {
      console.error('Eroare la scraping-ul cu Puppeteer:', error);
      return [];
    } finally {
      await browser.close();
    }
  }
}

export const scraperService = new ScraperService();
