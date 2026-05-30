// backend/src/scripts/seedMaterials.ts
import { PrismaClient } from '@prisma/client';
import { scraperService } from '../services/scraperService';
import { materialAnalyzer } from '../services/ai/materialAnalyzer';

const prisma = new PrismaClient();

// Listă de URL-uri de categorii esențiale de pe Dedeman (reprezentative pentru materiale la roșu)
const TARGET_URLS = [
  'https://www.dedeman.ro/ro/bca-ytong/c/824', // BCA
  'https://www.dedeman.ro/ro/fier-beton/c/321', // Armătură
  // Poți adăuga mai multe linkuri aici (cărămidă, țiglă, izolație)
];

function generateInternalCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Începem fluxul de Scraping + AI Semantic Mapping...');
  
  for (const url of TARGET_URLS) {
    console.log(`\n================================================`);
    console.log(`Procesare categorie: ${url}`);
    
    // 1. Scraping pentru extragere Nume și Preț (limitat la primele 3 produse pt viteză/testare)
    const rawProducts = await scraperService.scrapeCategory(url, 3);
    
    if (rawProducts.length === 0) {
      console.log(`Niciun produs extras de pe ${url}.`);
      continue;
    }

    for (const prod of rawProducts) {
      console.log(`\n🔹 Produs găsit: ${prod.name} (Preț: ${prod.pricePerUnit} RON)`);

      // Verificăm dacă există deja după URL pentru a nu face AI call degeaba
      const existing = await prisma.material.findFirst({ where: { storeUrl: prod.storeUrl } });
      if (existing) {
        console.log(`   Produsul există deja în DB (după URL). Se actualizează doar prețul...`);
        await prisma.material.update({
          where: { id: existing.id },
          data: { pricePerUnit: prod.pricePerUnit }
        });
        
        await prisma.priceHistory.create({
          data: {
            materialId: existing.id,
            price: prod.pricePerUnit,
            source: 'dedeman-scraper'
          }
        });
        continue;
      }

      // 2. AI Semantic Mapping (Entity Resolution)
      console.log(`   Se rulează analiza AI Gemini pentru proprietăți și Semantic Mapping...`);
      const analysis = await materialAnalyzer.analyzeMaterial(prod.name, prod.pricePerUnit, prod.storeUrl);
      
      if (!analysis) {
        console.log(`   Eșec analiză AI pentru ${prod.name}. Sărim produsul.`);
        continue;
      }

      console.log(`   AI Rezultat: Code [${analysis.standardCode}], Cat [${analysis.category}], uValue [${analysis.uValue}]`);

      // 3. Salvare în DB (Upsert după standardCode)
      // Folosim standardCode-ul generat de AI ca internalCode pentru a fi găsit de formulele BOM
      const descriptionWithAI = `${analysis.description}\n\n✅ Avantaj: ${analysis.pros}\n⚠️ Dezavantaj: ${analysis.cons}\nAlternativă: ${analysis.genericAlternatives.join(', ')}`;

      const savedMaterial = await prisma.material.upsert({
        where: { internalCode: analysis.standardCode },
        update: {
          name: prod.name, // Suprascriem cu cel mai recent produs din această categorie
          pricePerUnit: prod.pricePerUnit,
          storeUrl: prod.storeUrl,
          brand: analysis.brand || 'Necunoscut',
          description: descriptionWithAI
        },
        create: {
          internalCode: analysis.standardCode,
          name: prod.name,
          category: analysis.category,
          subcategory: analysis.subcategory || null,
          unit: analysis.unit,
          pricePerUnit: prod.pricePerUnit,
          brand: analysis.brand || 'Necunoscut',
          storeUrl: prod.storeUrl,
          description: descriptionWithAI,
          uValue: analysis.uValue,
          isDefault: true,
        }
      });
      
      await prisma.priceHistory.create({
        data: {
          materialId: savedMaterial.id,
          price: prod.pricePerUnit,
          source: 'dedeman-scraper'
        }
      });
      
      console.log(`   ✅ Produs mapat și salvat cu succes sub codul ${analysis.standardCode}!`);
    }
  }

  console.log('\nFlux completat.');
}

main()
  .catch((e) => {
    console.error('Eroare fatală în scriptul de seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
