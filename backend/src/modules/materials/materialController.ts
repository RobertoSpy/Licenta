import { Request, Response } from 'express';
import { materialRepository } from './materialRepository';

export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const materials = await materialRepository.findAll();
    const payload = materials.map((material) => ({
      ...material,
      price: material.pricePerUnit,
    }));
    res.json(payload);
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
