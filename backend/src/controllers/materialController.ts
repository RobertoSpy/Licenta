import { Request, Response } from 'express';
import { materialRepository } from '../repositories/materialRepository';

export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const materials = await materialRepository.findAll();
    res.json(materials);
  } catch (error) {
    console.error('[MaterialController] Eroare la preluarea materialelor:', error);
    res.status(500).json({ error: 'Eroare la preluarea materialelor' });
  }
};
