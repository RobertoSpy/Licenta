import { Request, Response } from 'express';
import { materialRepository } from '../repositories/materialRepository';
import { prisma } from '../lib/prisma';

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

    // Folosim prisma direct aici (sau prin repository)
    const baseMaterial = await prisma.material.findUnique({
      where: { internalCode } as any,
      include: {
        alternatives: true,
      } as any,
    });

    if (!baseMaterial) {
      res.status(404).json({ error: 'Materialul de bază nu a fost găsit' });
      return;
    }

    res.json((baseMaterial as any).alternatives || []);
  } catch (error: any) {
    console.error('[MaterialController] Eroare preluare alternative:', error);
    res.status(500).json({ error: 'Eroare la preluarea alternativelor' });
  }
};
