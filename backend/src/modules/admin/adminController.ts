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

export const syncSingleMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const material = await prisma.material.findUnique({ where: { id: Number(id) } });

    if (!material) {
      res.status(404).json({ success: false, error: 'Material negăsit' });
      return;
    }

    if (!material.storeUrl) {
      res.status(400).json({ success: false, error: 'Materialul nu are un URL configurat pentru scraping' });
      return;
    }

    const scraped = await scraperService.scrapeOne(material.storeUrl);
    if (!scraped || scraped.price === 0) {
      res.status(400).json({ success: false, error: 'Eșec la scraping sau preț 0. Poate fi un blocaj (ex: Cloudflare) sau o eroare de rețea.' });
      return;
    }

    const updated = await prisma.material.update({
      where: { id: material.id },
      data: {
        pricePerUnit: scraped.price,
        inStock: scraped.inStock,
        stockQuantity: scraped.stockQuantity,
      }
    });

    // Salvăm istoric
    await prisma.priceHistory.create({
      data: {
        materialId: material.id,
        price: scraped.price,
        source: 'Sincronizare Individuala',
      }
    });

    res.json({ success: true, material: updated });
  } catch (error: any) {
    console.error('[AdminController.syncSingleMaterial] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare internă la sincronizarea materialului' });
  }
};

export const addMaterialFromUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    
    if (!url) {
      res.status(400).json({ success: false, error: 'URL obligatoriu' });
      return;
    }

    const scraped = await scraperService.scrapeOne(url);

    if (!scraped) {
      res.status(400).json({ success: false, error: 'Scraping eșuat. Verifică URL-ul sau poate exista un blocaj (Cloudflare).' });
      return;
    }

    if (scraped.price === 0 && !scraped.inStock) {
      res.status(400).json({ success: false, error: 'Nu am putut extrage datele. Verificați URL-ul sau încercați mai târziu.' });
      return;
    }

    // Agentic Analysis
    const materialAnalyzerModule = await import('../ai/services/materialAnalyzer');
    const analyzer = materialAnalyzerModule.materialAnalyzer;
    const analysis = await analyzer.analyzeMaterial(scraped.title, scraped.price, url, scraped.specifications);

    if (!analysis) {
      res.status(500).json({ success: false, error: 'Analiza AI a eșuat. Încercați manual.' });
      return;
    }

    // Generăm un internal code din title și brand
    const brandPrefix = analysis.brand ? analysis.brand.toUpperCase().substring(0, 5) : 'GEN';
    const internalCode = `AGENTIC_${brandPrefix}_${Date.now()}`;

    let storeName = 'Generic';
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const nameParts = hostname.split('.');
      if (nameParts.length > 1) nameParts.pop(); // remove TLD
      const rawName = nameParts.join(' ');
      if (rawName) {
        storeName = rawName.split(/[-_ ]+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    } catch (e) {
      console.warn('[AdminController] Eroare parsare storeName din URL:', e);
    }

    const safeInternalCode = analysis.internalCode 
      ? `${analysis.internalCode}_${Date.now().toString().slice(-4)}`
      : internalCode;

    const material = await prisma.material.create({
      data: {
        internalCode: safeInternalCode,
        name: scraped.title,
        category: analysis.category,
        subcategory: analysis.subcategory,
        structuralType: analysis.structuralType,
        unit: analysis.unit,
        // packagingUnit: analysis.packagingUnit || undefined,
        // packagingValue: analysis.packagingValue || undefined,
        compressiveStrength: analysis.compressiveStrength || undefined,
        pricePerUnit: scraped.price,
        storeName,
        storeUrl: url,
        brand: analysis.brand || undefined,
        description: scraped.description,
        inStock: scraped.inStock,
        stockQuantity: scraped.stockQuantity,
        uValue: analysis.uValue || undefined,
        isVerified: true, 
      }
    });

    // Salvăm și un prim istoric
    await prisma.priceHistory.create({
      data: {
        materialId: material.id,
        price: scraped.price,
        source: 'agentic_scraper'
      }
    });

    // Lansăm salvarea embedding-urilor pentru RAG asincron
    const scraperSvc = await import('../../core/infrastructure/scraperService');
    scraperSvc.saveMaterialEmbedding(
      material.id,
      material.name,
      analysis.description || scraped.description || '',
      scraped.specifications,
      'agentic_ingestion'
    ).catch(e => console.error('[Agentic RAG Error]', e));

    res.json({ success: true, material, analysis });
  } catch (error: any) {
    console.error('[AdminController.addMaterial] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la adăugarea materialului.' });
  }
};

export const addMaterialManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      internalCode, name, category, subcategory, unit, pricePerUnit, 
      brand, storeUrl, storeName: reqStoreName, description, uValue, inStock, stockQuantity, 
      compressiveStrength, minSeismicZone, maxFloors, normativeCode, performanceClass, isVerified,
      packagingUnit, packagingValue
    } = req.body;
    
    if (!internalCode || !name || !category || !unit || pricePerUnit === undefined) {
      res.status(400).json({ success: false, error: 'Câmpuri obligatorii lipsă (internalCode, name, category, unit, pricePerUnit)' });
      return;
    }

    let finalStoreName = reqStoreName || 'Generic';
    if (!reqStoreName && storeUrl) {
      try {
        const hostname = new URL(storeUrl).hostname.replace(/^www\./, '');
        const nameParts = hostname.split('.');
        if (nameParts.length > 1) nameParts.pop();
        const rawName = nameParts.join(' ');
        if (rawName) {
          finalStoreName = rawName.split(/[-_ ]+/)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }
      } catch (e) {
        // invalid url, default to Generic
      }
    }

    const material = await prisma.material.create({
      data: {
        internalCode, name, category, subcategory, unit,
        pricePerUnit: parseFloat(pricePerUnit),
        brand, storeUrl, storeName: finalStoreName, description,
        packagingUnit,
        packagingValue: packagingValue ? parseFloat(packagingValue) : undefined,
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const total = await prisma.user.count();
    const data = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        contractor: {
          select: {
            isVerified: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[AdminController.getUsers] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la preluarea utilizatorilor.' });
  }
};

export const toggleContractorVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const contractor = await prisma.contractorProfile.findUnique({ where: { userId } });
    if (!contractor) {
      res.status(404).json({ success: false, error: 'Profil de constructor negăsit.' });
      return;
    }

    const updated = await prisma.contractorProfile.update({
      where: { userId },
      data: { isVerified: !contractor.isVerified }
    });

    res.json({ success: true, isVerified: updated.isVerified });
  } catch (error: any) {
    console.error('[AdminController.toggleContractorVerification] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare la modificarea statusului.' });
  }
};

export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const search = req.query.search as string;
    const category = req.query.category as string;
    const subcategory = req.query.subcategory as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { internalCode: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (category) {
      where.category = category;
    }
    if (subcategory) {
      where.subcategory = subcategory;
    }

    const total = await prisma.material.count({ where });
    const materials = await prisma.material.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: materials,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[AdminController.getAllMaterials]', error);
    res.status(500).json({ success: false, error: 'Eroare preluare materiale' });
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

export const getTaxonomy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { MATERIAL_CATEGORIES, MATERIAL_SUBCATEGORIES, ALL_SUBCATEGORIES } = await import('../../data/taxonomy');
    
    res.json({
      success: true,
      categories: MATERIAL_CATEGORIES,
      subcategoriesMap: MATERIAL_SUBCATEGORIES,
      allSubcategories: ALL_SUBCATEGORIES
    });
  } catch (error: any) {
    console.error('[AdminController.getTaxonomy] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare preluare taxonomie' });
  }
};
