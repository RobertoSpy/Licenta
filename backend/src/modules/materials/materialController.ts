import { Request, Response } from 'express';
import { materialRepository } from './materialRepository';

export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    const subcategory = req.query.subcategory as string;
    const search = req.query.search as string;

    const result = await materialRepository.findAll(page, limit, category, subcategory, search);
    res.json(result);
  } catch (error) {
    console.error('[MaterialController] Eroare la preluarea materialelor:', error);
    res.status(500).json({ error: 'Eroare la preluarea materialelor' });
  }
};

export const getAlternatives = async (req: Request, res: Response): Promise<void> => {
  try {
    const internalCode = req.params.internalCode as string;

    const baseMaterial = await materialRepository.findByInternalCodeWithAlternatives(internalCode);

    if (!baseMaterial) {
      res.status(404).json({ error: 'Materialul de bază nu a fost găsit' });
      return;
    }

    res.json(baseMaterial.alternatives || []);
  } catch (error: any) {
    console.error('[MaterialController] Eroare preluare alternative:', error);
    res.status(500).json({ error: 'Eroare la preluarea alternativelor' });
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
    console.error('[MaterialController.getTaxonomy] Eroare:', error);
    res.status(500).json({ success: false, error: 'Eroare preluare taxonomie' });
  }
};
