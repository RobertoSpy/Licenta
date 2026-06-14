import { Material } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const materialRepository = {
  async findAll(): Promise<Material[]> {
    return prisma.material.findMany();
  },

  async findByInternalCodeWithAlternatives(internalCode: string) {
    // 1. Caută materialul de bază
    const baseMaterial = await prisma.material.findUnique({
      where: { internalCode },
    });

    if (!baseMaterial) return null;

    // 2. Găsește TOATE materialele din DB din aceeași categorie și subcategorie,
    // excluzând materialul curent.
    const alternatives = await prisma.material.findMany({
      where: {
        category: baseMaterial.category,
        subcategory: baseMaterial.subcategory,
        id: { not: baseMaterial.id },
      },
    });

    // 3. Returnează materialul cu lista dinamică atașată
    return {
      ...baseMaterial,
      alternatives,
    };
  },
};
