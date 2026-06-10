"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scraperService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const prisma_1 = require("../../lib/prisma");
const embeddingService_1 = require("../../modules/ai/services/embeddingService");
exports.scraperService = {
    /**
     * Extrage date despre un material direct de pe Dedeman (sau returnează null dacă eșuează).
     */
    scrapeProductPage(url, fallbackDescription, fallbackSpecs) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[ScraperService] Inițializare browser pentru: ${url}`);
            const browser = yield puppeteer_1.default.launch({
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
                const page = yield browser.newPage();
                yield page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                yield page.setViewport({ width: 1280, height: 800 });
                const response = yield page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                if (response && response.status() === 403) {
                    throw new Error('Blocat de Cloudflare (403)');
                }
                const priceElement = yield page.$('.product-price');
                const imgElement = yield page.$('.product-image img, .gallery img, img.lazyload');
                let price = 0;
                let inStock = true;
                let stockQuantity = null;
                let description = fallbackDescription || '';
                let specifications = fallbackSpecs || '';
                let imageUrl = null;
                if (imgElement) {
                    imageUrl = yield page.evaluate(el => el.getAttribute('src'), imgElement);
                }
                if (priceElement) {
                    const priceText = yield page.evaluate(el => el.textContent, priceElement);
                    price = parseFloat((priceText || '0').replace(/[^0-9,.]/g, '').replace(',', '.'));
                }
                else {
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
            }
            catch (error) {
                console.error(`[ScraperService] Eroare la scraping pentru ${url}:`, error.message);
                return null;
            }
            finally {
                yield browser.close();
            }
        });
    },
    /**
     * Generează embedding și salvează în MaterialChunk (pgvector).
     */
    saveMaterialChunk(materialId, content, source) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!content || content.trim().length === 0)
                return;
            console.log(`[ScraperService] Generare vector pentru material_id=${materialId}...`);
            try {
                const vectorArray = yield embeddingService_1.embeddingService.embed(content);
                const vectorStr = `[${vectorArray.join(',')}]`;
                // Folosim upsert brut pentru a lucra cu Unsupported("vector(768)")
                yield prisma_1.prisma.$executeRawUnsafe(`
        INSERT INTO "MaterialChunk" ("materialId", "content", "source", "embedding")
        VALUES ($1, $2, $3, $4::vector)
      `, materialId, content, source, vectorStr);
                console.log(`[ScraperService] Vector salvat cu succes pentru material_id=${materialId}.`);
            }
            catch (err) {
                console.error(`[ScraperService] Eroare la salvarea embedding-ului pt material_id=${materialId}:`, err.message);
            }
        });
    },
    /**
     * Sincronizează toate materialele din baza de date care au un \`storeUrl\` setat.
     */
    syncAllMaterials() {
        return __awaiter(this, arguments, void 0, function* (generateEmbeddings = false) {
            const materials = yield prisma_1.prisma.material.findMany({
                where: { storeUrl: { not: null } }
            });
            let updated = 0;
            let failed = 0;
            for (const mat of materials) {
                if (!mat.storeUrl)
                    continue;
                try {
                    const scraped = yield this.scrapeProductPage(mat.storeUrl, mat.description || undefined);
                    if (scraped && scraped.price > 0) {
                        yield prisma_1.prisma.material.update({
                            where: { id: mat.id },
                            data: Object.assign({ pricePerUnit: scraped.price, inStock: scraped.inStock, stockQuantity: scraped.stockQuantity, description: scraped.description || mat.description }, (scraped.imageUrl && { imageUrl: scraped.imageUrl }))
                        });
                        yield prisma_1.prisma.priceHistory.create({
                            data: {
                                materialId: mat.id,
                                price: scraped.price,
                                source: 'dedeman_scraper'
                            }
                        });
                        if (generateEmbeddings) {
                            const combinedContent = `${mat.name}. ${scraped.description}. ${scraped.specifications}`;
                            // Verifică dacă există deja chunks pentru a nu duplica
                            const existingChunks = yield prisma_1.prisma.$queryRawUnsafe(`SELECT id FROM "MaterialChunk" WHERE "materialId" = $1 LIMIT 1`, mat.id);
                            if (existingChunks.length === 0) {
                                yield this.saveMaterialChunk(mat.id, combinedContent, 'dedeman-scrape');
                            }
                        }
                        updated++;
                    }
                    else {
                        failed++;
                    }
                    yield new Promise(r => setTimeout(r, 2000));
                }
                catch (e) {
                    failed++;
                }
            }
            return { updated, failed };
        });
    }
};
