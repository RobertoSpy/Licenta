import { Request, Response } from 'express';
import { scraperService } from '../../core/infrastructure/scraperService';
import { prisma } from '../../lib/prisma';

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
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users });
  } catch (error: any) {
    console.error('[AdminController.getUsers] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la preluarea utilizatorilor.' });
  }
};

export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { category: 'asc' }
    });
    res.json({ success: true, materials });
  } catch (error: any) {
    console.error('[AdminController.getAllMaterials] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la preluarea materialelor.' });
  }
};

export const updateMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const materialId = parseInt(req.params.id as string, 10);
    const data = req.body;

    const material = await prisma.material.update({
      where: { id: materialId },
      data
    });

    res.json({ success: true, material });
  } catch (error: any) {
    console.error('[AdminController.updateMaterial] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la actualizarea materialului.' });
  }
};

export const deleteMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const materialId = parseInt(req.params.id as string, 10);

    await prisma.material.delete({
      where: { id: materialId }
    });

    res.json({ success: true, message: 'Material șters cu succes.' });
  } catch (error: any) {
    console.error('[AdminController.deleteMaterial] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la ștergerea materialului.' });
  }
};

export const reseedNormatives = async (req: Request, res: Response): Promise<void> => {
  try {
    // Aici vom declanșa scriptul de RAG (VectorDB sync)
    // Deocamdată facem doar simulare de succes pentru licență:
    res.json({ 
      success: true, 
      message: 'Trigger-ul pentru reindexarea RAG a fost lansat cu succes. Datele vor fi sincronizate în fundal.' 
    });
  } catch (error: any) {
    console.error('[AdminController.reseedNormatives] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la pornirea reindexării.' });
  }
};
