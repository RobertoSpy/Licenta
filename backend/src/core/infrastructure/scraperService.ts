import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { prisma } from '../../lib/prisma';
import { embeddingService } from '../../modules/ai/services/embeddingService';

// Stealth plugin — bypass Cloudflare bot detection
// Ascunde navigator.webdriver, patching-uri V8, canvas fingerprint etc.
puppeteer.use(StealthPlugin());

export interface ScrapedData {
  price: number;
  inStock: boolean;
  stockQuantity: number | null;
  description: string;
  specifications: Record<string, string>; // { "Clasa de rezistenta": "D3", "Dimensiuni": "25x24x59" }
}

/**
 * Extrage toate datele relevante de pe o pagina de produs Dedeman.
 * Returneaza null daca pagina e blocata sau structura s-a schimbat.
 */
export async function scrapeDedemanProduct(url: string): Promise<ScrapedData | null> {
  console.log(`[Scraper] Pornire browser stealth pentru: ${url}`);

  const browser = await (puppeteer as any).launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Setari realiste de browser
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    const status = response?.status();
    if (status === 403 || status === 429) {
      console.warn(`[Scraper] Blocat cu status ${status} de pe ${url}`);
      return null;
    }

    // Asteapta sa apara pretul in DOM
    await page.waitForSelector('.price-new, .product-price, [class*="price"]', {
      timeout: 10000,
    }).catch(() => {
      console.warn('[Scraper] Selectorul de pret nu a aparut in 10s');
    });

    const data = await page.evaluate(() => {
      // ── PRET ────────────────────────────────────────────────────────────────
      // Dedeman foloseste mai multi selectori in functie de pagina/promotie
      const priceSelectors = [
        '.price-new',
        '.product-price .price',
        '[class*="productPrice"]',
        '[itemprop="price"]',
        '.price-box .price',
        '.special-price .price',
        '.regular-price .price',
      ];

      let rawPrice = '';
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          rawPrice = el.textContent.trim();
          break;
        }
      }

      // Curata pretul: "1.234,56 Lei" → 1234.56
      const priceNum = parseFloat(
        rawPrice
          .replace(/[^\d,\.]/g, '')   // pastreaza doar cifre, virgula, punct
          .replace(/\.(?=\d{3})/g, '') // elimina punctul de mii (1.234 → 1234)
          .replace(',', '.')           // virgula zecimala → punct
      );
      const price = isNaN(priceNum) ? 0 : priceNum;

      // ── STOC ────────────────────────────────────────────────────────────────
      const stockEl = document.querySelector(
        '.availability, [class*="stock"], [class*="availability"], .in-stock, .out-of-stock'
      );
      const stockText = stockEl?.textContent?.toLowerCase() || '';
      const inStock = !stockText.includes('indisponibil') &&
                      !stockText.includes('stoc epuizat') &&
                      !stockText.includes('out of stock');

      // Cantitate numerica daca e afisata (ex: "23 buc in stoc")
      const stockQtyMatch = stockText.match(/(\d+)\s*(buc|bucati|buc\.)/);
      const stockQuantity = stockQtyMatch ? parseInt(stockQtyMatch[1]) : null;

      // ── DESCRIERE ───────────────────────────────────────────────────────────
      const descSelectors = [
        '.product-description',
        '[class*="productDescription"]',
        '.description .content',
        '#description',
        '.tab-content .description',
        '[itemprop="description"]',
      ];

      let description = '';
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          description = el.textContent.trim().slice(0, 1000); // max 1000 chars
          break;
        }
      }

      // ── SPECIFICATII TEHNICE ─────────────────────────────────────────────────
      // Dedeman afiseaza specs ca tabel sau lista de perechi cheie-valoare
      const specifications: Record<string, string> = {};

      // Varianta tabel
      const tableRows = document.querySelectorAll(
        '.product-attributes tr, .specifications tr, [class*="attributes"] tr'
      );
      tableRows.forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0].textContent?.trim() || '';
          const val = cells[1].textContent?.trim() || '';
          if (key && val) specifications[key] = val;
        }
      });

      // Varianta lista dl/dt/dd
      if (Object.keys(specifications).length === 0) {
        const dts = document.querySelectorAll('.product-attributes dt, .specifications dt');
        dts.forEach((dt) => {
          const dd = dt.nextElementSibling;
          if (dd?.tagName === 'DD') {
            specifications[dt.textContent?.trim() || ''] = dd.textContent?.trim() || '';
          }
        });
      }

      return { price, inStock, stockQuantity, description, specifications };
    });

    if (data.price === 0) {
      console.warn(`[Scraper] Pret 0 extras din ${url} — posibil selector gresit sau pagina schimbata`);
      return null;
    }

    console.log(`[Scraper] ✅ Extras: ${data.price} RON | stoc: ${data.inStock} | specs: ${Object.keys(data.specifications).length} campuri`);
    return data;

  } catch (err: any) {
    console.error(`[Scraper] ❌ Eroare pentru ${url}:`, err.message);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Genereaza embedding si salveaza in MaterialChunk (pgvector).
 * Combina toate datele textuale ale materialului pentru un vector bogat semantic.
 */
export async function saveMaterialEmbedding(
  materialId: number,
  name: string,
  description: string,
  specifications: Record<string, string>,
  source: string
): Promise<void> {
  // Construieste continut textual bogat pentru embedding
  const specsText = Object.entries(specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('. ');

  const content = [name, description, specsText].filter(Boolean).join('. ').trim();

  if (!content || content.length < 10) {
    console.warn(`[Scraper] Continut prea scurt pentru embedding, material_id=${materialId}`);
    return;
  }

  try {
    const vectorArray = await embeddingService.embed(content);
    const vectorStr = `[${vectorArray.join(',')}]`;

    // Upsert — nu duplica daca exista deja
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MaterialChunk" ("materialId", "content", "source", "embedding")
      VALUES ($1, $2, $3, $4::vector)
      ON CONFLICT ("materialId") DO UPDATE
        SET "content" = EXCLUDED."content",
            "embedding" = EXCLUDED."embedding",
            "source" = EXCLUDED."source"
    `, materialId, content, source, vectorStr);

    console.log(`[Scraper] Vector salvat pentru material_id=${materialId}`);
  } catch (err: any) {
    console.error(`[Scraper] Eroare embedding material_id=${materialId}:`, err.message);
  }
}

/**
 * Sincronizeaza toate materialele din DB care au storeUrl.
 * Apelat manual din AdminPanel sau dintr-un cron job.
 */
export const scraperService = {
  async syncAllMaterials(options: {
    generateEmbeddings?: boolean;
    delayMs?: number;         // delay intre requesturi (default 3000ms)
    onlyMissingPrices?: boolean; // scrapa doar materialele fara pret istoric
  } = {}): Promise<{ updated: number; failed: number; skipped: number }> {
    const { generateEmbeddings = false, delayMs = 3000, onlyMissingPrices = false } = options;

    const where: any = { storeUrl: { not: null } };

    const materials = await prisma.material.findMany({ where });

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const mat of materials) {
      if (!mat.storeUrl) continue;

      // Daca onlyMissingPrices, sarim materialele cu istoric recent (< 7 zile)
      if (onlyMissingPrices) {
        const recent = await prisma.priceHistory.findFirst({
          where: {
            materialId: mat.id,
            scrapedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });
        if (recent) { skipped++; continue; }
      }

      const scraped = await scrapeDedemanProduct(mat.storeUrl);

      if (!scraped) {
        failed++;
        // Adauga delay mai mare dupa esec (posibil rate limit temporar)
        await new Promise(r => setTimeout(r, delayMs * 2));
        continue;
      }

      // Actualizeaza materialul
      await prisma.material.update({
        where: { id: mat.id },
        data: {
          pricePerUnit: scraped.price,
          inStock: scraped.inStock,
          stockQuantity: scraped.stockQuantity,
          // Actualizeaza descrierea DOAR daca e mai bogata decat cea existenta
          ...(scraped.description.length > (mat.description?.length || 0) && {
            description: scraped.description,
          }),
        },
      });

      // Salveaza in istoricul de preturi
      await prisma.priceHistory.create({
        data: {
          materialId: mat.id,
          price: scraped.price,
          source: 'dedeman_scraper',
        },
      });

      // Genereaza embedding pentru RAG daca e cerut
      if (generateEmbeddings) {
        await saveMaterialEmbedding(
          mat.id,
          mat.name,
          scraped.description || mat.description || '',
          scraped.specifications,
          'dedeman-scrape'
        );
      }

      updated++;
      console.log(`[Scraper] (${updated + failed}/${materials.length}) ${mat.name}: ${scraped.price} RON`);

      // Delay intre requesturi pentru a evita ban
      await new Promise(r => setTimeout(r, delayMs));
    }

    console.log(`[Scraper] Sync complet: ${updated} actualizate, ${failed} esuate, ${skipped} sarite`);
    return { updated, failed, skipped };
  },

  /**
   * Scrapa un singur produs dupa URL — util pentru test din AdminPanel.
   */
  async scrapeOne(url: string): Promise<ScrapedData | null> {
    return scrapeDedemanProduct(url);
  },
};
