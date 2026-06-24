import { prisma } from '../../lib/prisma';
import { Material } from '@prisma/client';

export type MaterialQueryType = 'STRICT_NORMATIVE' | 'NORMATIVE_BUDGET' | 'FREE_PREFERENCE' | 'CONDITIONAL_NORMATIVE';

export interface MaterialQuery {
  type?: MaterialQueryType;
  engineKey?: string; // used for STRICT_NORMATIVE
  category?: string;
  subcategory?: string; // semantic role code
  internalCode?: string; // specific material code
  constraints?: {
    maxUValue?: number;
    minStrength?: number;
    conformsTo?: string;
  };
}

export async function selectMaterialForBOM(
  query: MaterialQuery,
  budgetCategory: string,
  engineSuggestedCode?: string,
  projectSeismicZoneFloat?: number // e.g. 0.25 from "0.25g"
): Promise<Material | null> {
  
  // 1. STRICT_NORMATIVE: Respectăm strict codul motorului (care acum este o subcategorie, ex: CONCRETE_C25_30)
  if (query.type === 'STRICT_NORMATIVE') {
    if (!engineSuggestedCode) {
      throw new Error(`Lipsă engineSuggestedCode pentru ${query.engineKey}`);
    }
    const conformingMaterials = await prisma.material.findMany({
      where: { internalCode: engineSuggestedCode, inStock: true },
      orderBy: { pricePerUnit: 'asc' }
    });

    if (!conformingMaterials.length) {
      return null;
    }

    const totalItems = conformingMaterials.length;
    const budgetStrategy: Record<string, number> = {
      economic: 0,
      mediu: Math.floor((totalItems - 1) / 2),
      premium: totalItems - 1
    };

    const selectedIndex = budgetStrategy[budgetCategory];
    if (selectedIndex === undefined) {
      throw new Error(`Budget category "${budgetCategory}" este invalidă sau lipsește.`);
    }

    return conformingMaterials[selectedIndex];
  }

  // Definim filtrele de bază
  const whereClause: any = {
    category: query.category,
    inStock: true
  };
  if (query.subcategory) {
    whereClause.subcategory = query.subcategory;
  }
  if (query.internalCode) {
    whereClause.internalCode = query.internalCode;
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

  const orderByClause: any = { pricePerUnit: 'asc' };

  const conformingMaterials = await prisma.material.findMany({
    where: whereClause,
    orderBy: orderByClause
  });

  if (!conformingMaterials.length) {
    return null; // Va fi logat și va sări formula respectivă în bomService
  }

  const totalItems = conformingMaterials.length;
  
  const budgetStrategy: Record<string, number> = {
    economic: 0,                                      // Primul element (cel mai ieftin)
    mediu: Math.floor((totalItems - 1) / 2),          // Elementul median
    premium: totalItems - 1                           // Elementul cel mai scump
  };

  const selectedIndex = budgetStrategy[budgetCategory];
  
  if (selectedIndex === undefined) {
    throw new Error(`Budget category "${budgetCategory}" este invalidă sau lipsește.`);
  }

  return conformingMaterials[selectedIndex];
}
