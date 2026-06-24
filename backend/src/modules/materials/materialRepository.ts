import { Material } from '@prisma/client';
import { prisma } from '../../lib/prisma';
export const materialRepository = {
  async findAll(page: number = 1, limit: number = 20, category?: string, subcategory?: string, search?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { internalCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const total = await prisma.material.count({ where });
    const skip = (page - 1) * limit;

    const data = await prisma.material.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' }
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
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
