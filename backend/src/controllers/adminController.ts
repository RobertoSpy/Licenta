import { Request, Response } from 'express';
import { scraperService } from '../services/scraperService';
import { prisma } from '../lib/prisma';

export const syncDedemanMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await scraperService.syncAllMaterials();
    res.json({
      success: true,
      message: `Sincronizare completă. ${result.updated} actualizate, ${result.failed} eșuate.`,
      ...result
    });
  } catch (error: any) {
    console.error('[AdminController.sync] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la sincronizarea materialelor.' });
  }
};

export const addMaterialFromUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, category, subcategory, unit, internalCode, name } = req.body;
    
    if (!url || !internalCode || !name || !category || !unit) {
      res.status(400).json({ success: false, error: 'Câmpuri obligatorii lipsă (url, internalCode, name, category, unit)' });
      return;
    }

    const scraped = await scraperService.scrapeProductPage(url);

    if (!scraped) {
      res.status(400).json({ success: false, error: 'Scraping eșuat. Verifică URL-ul sau poate exista un blocaj (Cloudflare).' });
      return;
    }

    if (scraped.price === 0 && !scraped.inStock) {
      res.status(400).json({ success: false, error: 'Nu am putut extrage datele. Verificați URL-ul sau încercați mai târziu.' });
      return;
    }

    const material = await prisma.material.create({
      data: {
        internalCode,
        name,
        category,
        subcategory,
        unit,
        pricePerUnit: scraped.price,
        storeUrl: url,
        description: scraped.description,
        inStock: scraped.inStock,
        stockQuantity: scraped.stockQuantity,
        ...(scraped.imageUrl && { imageUrl: scraped.imageUrl }),
      }
    });

    // Salvăm și un prim istoric
    await prisma.priceHistory.create({
      data: {
        materialId: material.id,
        price: scraped.price,
        source: 'dedeman_scraper_manual'
      }
    });

    res.json({ success: true, material });
  } catch (error: any) {
    console.error('[AdminController.addMaterial] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la adăugarea materialului.' });
  }
};
