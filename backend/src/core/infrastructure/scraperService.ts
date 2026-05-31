import puppeteer from 'puppeteer';
import { prisma } from '../../lib/prisma';
import { embeddingService } from '../../modules/ai/services/embeddingService';

export interface ScrapedData {
  price: number;
  inStock: boolean;
  stockQuantity: number | null;
  description: string;
  specifications: string;
  imageUrl: string | null;
}

export const scraperService = {
  /**
   * Extrage date despre un material direct de pe Dedeman (sau returnează null dacă eșuează).
   */
  async scrapeProductPage(url: string, fallbackDescription?: string, fallbackSpecs?: string): Promise<ScrapedData | null> {
    console.log(`[ScraperService] Inițializare browser pentru: ${url}`);
    
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1280, height: 800 });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (response && response.status() === 403) {
        throw new Error('Blocat de Cloudflare (403)');
      }

      const priceElement = await page.$('.product-price');
      const imgElement = await page.$('.product-image img, .gallery img, img.lazyload');
      let price = 0;
      let inStock = true;
      let stockQuantity = null;
      let description = fallbackDescription || '';
      let specifications = fallbackSpecs || '';
      let imageUrl = null;

      if (imgElement) {
         imageUrl = await page.evaluate(el => el.getAttribute('src'), imgElement);
      }

      if (priceElement) {
         const priceText = await page.evaluate(el => el.textContent, priceElement);
         price = parseFloat((priceText || '0').replace(/[^0-9,.]/g, '').replace(',', '.'));
      } else {
         console.warn(`[ScraperService] Nu am putut găsi prețul pe pagina ${url}. Păstrăm prețul din seed.`);
         return null;
      }

      return {
        price,
        inStock,
        stockQuantity,
        description,
        specifications,
        imageUrl
      };
    } catch (error: any) {
      console.error(`[ScraperService] Eroare la scraping pentru ${url}:`, error.message);
      return null;
    } finally {
      await browser.close();
    }
  },

  /**
   * Generează embedding și salvează în MaterialChunk (pgvector).
   */
  async saveMaterialChunk(materialId: number, content: string, source: string) {
    if (!content || content.trim().length === 0) return;
    
    console.log(`[ScraperService] Generare vector pentru material_id=${materialId}...`);
    try {
      const vectorArray = await embeddingService.embed(content);
      const vectorStr = `[${vectorArray.join(',')}]`;

      // Folosim upsert brut pentru a lucra cu Unsupported("vector(768)")
      await prisma.$executeRawUnsafe(`
        INSERT INTO "MaterialChunk" ("materialId", "content", "source", "embedding")
        VALUES ($1, $2, $3, $4::vector)
      `, materialId, content, source, vectorStr);

      console.log(`[ScraperService] Vector salvat cu succes pentru material_id=${materialId}.`);
    } catch (err: any) {
      console.error(`[ScraperService] Eroare la salvarea embedding-ului pt material_id=${materialId}:`, err.message);
    }
  },

  /**
   * Sincronizează toate materialele din baza de date care au un \`storeUrl\` setat.
   */
  async syncAllMaterials(generateEmbeddings: boolean = false): Promise<{ updated: number, failed: number }> {
    const materials = await prisma.material.findMany({
      where: { storeUrl: { not: null } }
    });

    let updated = 0;
    let failed = 0;

    for (const mat of materials) {
      if (!mat.storeUrl) continue;
      
      try {
        const scraped = await this.scrapeProductPage(mat.storeUrl, mat.description || undefined);
        
        if (scraped && scraped.price > 0) {
          await prisma.material.update({
            where: { id: mat.id },
            data: {
              pricePerUnit: scraped.price,
              inStock: scraped.inStock,
              stockQuantity: scraped.stockQuantity,
              description: scraped.description || mat.description,
              ...(scraped.imageUrl && { imageUrl: scraped.imageUrl }),
            }
          });
          
          await prisma.priceHistory.create({
            data: {
              materialId: mat.id,
              price: scraped.price,
              source: 'dedeman_scraper'
            }
          });
          
          if (generateEmbeddings) {
            const combinedContent = `${mat.name}. ${scraped.description}. ${scraped.specifications}`;
            // Verifică dacă există deja chunks pentru a nu duplica
            const existingChunks = await prisma.$queryRawUnsafe<{id: number}[]>(
              `SELECT id FROM "MaterialChunk" WHERE "materialId" = $1 LIMIT 1`, mat.id
            );
            
            if (existingChunks.length === 0) {
              await this.saveMaterialChunk(mat.id, combinedContent, 'dedeman-scrape');
            }
          }
          
          updated++;
        } else {
          failed++;
        }
        
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        failed++;
      }
    }

    return { updated, failed };
  }
};
