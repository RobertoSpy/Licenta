import { prisma } from '../../lib/prisma';
import { Material } from '@prisma/client';

export type MaterialQueryType = 'STRICT_NORMATIVE' | 'NORMATIVE_BUDGET' | 'FREE_PREFERENCE' | 'CONDITIONAL_NORMATIVE';

export interface MaterialQuery {
  type: MaterialQueryType;
  engineKey?: string; // used for STRICT_NORMATIVE
  category?: string;
  subcategory?: string;
  constraints?: {
    maxUValue?: number;
    minStrength?: number;
    conformsTo?: string;
  };
}

export async function selectMaterialForBOM(
  query: MaterialQuery,
  budgetCategory: 'economic' | 'mediu',
  engineSuggestedCode?: string,
  projectSeismicZoneFloat?: number // e.g. 0.25 from "0.25g"
): Promise<Material | null> {
  
  // 1. STRICT_NORMATIVE: Ignorăm bugetul, respectăm strict motorul (ex. C25/30)
  if (query.type === 'STRICT_NORMATIVE') {
    if (!engineSuggestedCode) {
      throw new Error(`Lipsă engineSuggestedCode pentru ${query.engineKey}`);
    }
    const material = await prisma.material.findUnique({
      where: { internalCode: engineSuggestedCode }
    });
    // Fallback logic handled in bomService if null
    return material;
  }

  // Definim filtrele de bază
  const whereClause: any = {
    category: query.category,
    inStock: true
  };
  if (query.subcategory) {
    whereClause.subcategory = query.subcategory;
  }

  // 2. NORMATIVE_BUDGET: Aplicăm constrângerile + sortăm funcție de buget
  if (query.type === 'NORMATIVE_BUDGET') {
    // Aplicăm constrângerile normative
    if (query.constraints?.maxUValue) {
      whereClause.uValue = { lte: query.constraints.maxUValue };
    }
    if (query.constraints?.minStrength) {
      whereClause.compressiveStrength = { gte: query.constraints.minStrength };
    }
    if (projectSeismicZoneFloat !== undefined) {
      whereClause.OR = [
        { minSeismicZone: { lte: projectSeismicZoneFloat } },
        { minSeismicZone: null }
      ];
    }
    
    // Human-in-the-loop: pt structură ne bazăm pe materiale verificate
    // (Omitere momentană dacă catalogul e la început, dar ideal ar fi isVerified: true)
  }

  // 3. FREE_PREFERENCE: Nicio constrângere suplimentară, doar sortare

  const orderByClause: any = budgetCategory === 'economic' 
    ? { pricePerUnit: 'asc' } 
    : { pricePerUnit: 'asc' };

  const conformingMaterials = await prisma.material.findMany({
    where: whereClause,
    orderBy: orderByClause
  });

  if (!conformingMaterials.length) {
    return null; // Va fi logat și va sări formula respectivă în bomService
  }

  // Extragem materialul corect din listă
  if (budgetCategory === 'mediu') {
    return conformingMaterials[Math.floor(conformingMaterials.length / 2)];
  }

  return conformingMaterials[0];
}
