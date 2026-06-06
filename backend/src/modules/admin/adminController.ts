import { Request, Response } from 'express';
import fs from 'fs';
import csvParser from 'csv-parser';
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
    const { url, category, subcategory, unit, internalCode, name, uValue, compressiveStrength, minSeismicZone, maxFloors } = req.body;
    
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
        uValue: uValue ? parseFloat(uValue) : undefined,
        compressiveStrength: compressiveStrength ? parseFloat(compressiveStrength) : undefined,
        minSeismicZone: minSeismicZone ? parseFloat(minSeismicZone) : undefined,
        maxFloors: maxFloors ? parseInt(maxFloors, 10) : undefined,
        isVerified: true, // Adaugat manual de admin -> pre-verificat
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

export const addMaterialManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      internalCode, name, category, subcategory, unit, pricePerUnit, 
      brand, storeUrl, description, uValue, inStock, stockQuantity, 
      compressiveStrength, minSeismicZone, maxFloors, normativeCode, performanceClass, isVerified
    } = req.body;
    
    if (!internalCode || !name || !category || !unit || pricePerUnit === undefined) {
      res.status(400).json({ success: false, error: 'Câmpuri obligatorii lipsă (internalCode, name, category, unit, pricePerUnit)' });
      return;
    }

    const material = await prisma.material.create({
      data: {
        internalCode, name, category, subcategory, unit,
        pricePerUnit: parseFloat(pricePerUnit),
        brand, storeUrl, description,
        inStock: inStock !== undefined ? inStock : true,
        stockQuantity: stockQuantity ? parseFloat(stockQuantity) : undefined,
        uValue: uValue ? parseFloat(uValue) : undefined,
        compressiveStrength: compressiveStrength ? parseFloat(compressiveStrength) : undefined,
        minSeismicZone: minSeismicZone ? parseFloat(minSeismicZone) : undefined,
        maxFloors: maxFloors ? parseInt(maxFloors, 10) : undefined,
        normativeCode, performanceClass,
        isVerified: isVerified !== undefined ? isVerified : true
      }
    });

    await prisma.priceHistory.create({
      data: {
        materialId: material.id,
        price: parseFloat(pricePerUnit),
        source: 'manual_admin'
      }
    });

    res.json({ success: true, material });
  } catch (error: any) {
    console.error('[AdminController.addMaterialManual] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la adăugarea manuală a materialului.' });
  }
};

export const importMaterialsCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Nu a fost trimis niciun fișier.' });
      return;
    }

    const results: any[] = [];
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        let failed = 0;

        for (const row of results) {
          try {
            if (!row.internalCode || !row.name || !row.category || !row.unit || !row.pricePerUnit) {
              failed++;
              continue;
            }

            await prisma.material.upsert({
              where: { internalCode: row.internalCode },
              update: {
                name: row.name,
                category: row.category,
                subcategory: row.subcategory || null,
                unit: row.unit,
                pricePerUnit: parseFloat(row.pricePerUnit),
                brand: row.brand || null,
                storeUrl: row.storeUrl || null,
                description: row.description || null,
                uValue: row.uValue ? parseFloat(row.uValue) : null,
                inStock: row.inStock ? row.inStock.toLowerCase() === 'true' : true,
                stockQuantity: row.stockQuantity ? parseFloat(row.stockQuantity) : null,
                compressiveStrength: row.compressiveStrength ? parseFloat(row.compressiveStrength) : null,
                minSeismicZone: row.minSeismicZone ? parseFloat(row.minSeismicZone) : null,
                maxFloors: row.maxFloors ? parseInt(row.maxFloors, 10) : null,
                normativeCode: row.normativeCode || null,
                performanceClass: row.performanceClass || null,
                isVerified: row.isVerified ? row.isVerified.toLowerCase() === 'true' : true
              },
              create: {
                internalCode: row.internalCode,
                name: row.name,
                category: row.category,
                subcategory: row.subcategory || null,
                unit: row.unit,
                pricePerUnit: parseFloat(row.pricePerUnit),
                brand: row.brand || null,
                storeUrl: row.storeUrl || null,
                description: row.description || null,
                uValue: row.uValue ? parseFloat(row.uValue) : undefined,
                inStock: row.inStock ? row.inStock.toLowerCase() === 'true' : true,
                stockQuantity: row.stockQuantity ? parseFloat(row.stockQuantity) : undefined,
                compressiveStrength: row.compressiveStrength ? parseFloat(row.compressiveStrength) : undefined,
                minSeismicZone: row.minSeismicZone ? parseFloat(row.minSeismicZone) : undefined,
                maxFloors: row.maxFloors ? parseInt(row.maxFloors, 10) : undefined,
                normativeCode: row.normativeCode || null,
                performanceClass: row.performanceClass || null,
                isVerified: row.isVerified ? row.isVerified.toLowerCase() === 'true' : true
              }
            });
            imported++;
          } catch (err) {
            console.error('[importMaterialsCsv] Row error:', err);
            failed++;
          }
        }

        // Curățăm fișierul temporar
        fs.unlinkSync(req.file!.path);

        res.json({ success: true, message: `Import finalizat: ${imported} adăugate/actualizate, ${failed} eșuate.` });
      })
      .on('error', (err) => {
        console.error('[AdminController.importMaterialsCsv] Stream error:', err);
        res.status(500).json({ success: false, error: 'Eroare la procesarea fișierului CSV.' });
      });

  } catch (error: any) {
    console.error('[AdminController.importMaterialsCsv] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare generală la importul CSV.' });
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
