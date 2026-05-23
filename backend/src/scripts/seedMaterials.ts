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
  console.log('Începem fluxul de Scraping + AI Enrichment...');
  
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
      const internalCode = generateInternalCode(prod.name);

      // Verificăm dacă există deja pentru a nu face AI call degeaba pe lucruri neschimbate
      const existing = await prisma.material.findUnique({ where: { internalCode } });
      if (existing) {
        console.log(`   Produsul există deja în DB. Se actualizează doar prețul...`);
        await prisma.material.update({
          where: { internalCode },
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

      // 2. AI Semantic Enrichment
      console.log(`   Se rulează analiza AI Gemini pentru proprietăți...`);
      const analysis = await materialAnalyzer.analyzeMaterial(prod.name, prod.pricePerUnit, prod.storeUrl);
      
      if (!analysis) {
        console.log(`   Eșec analiză AI pentru ${prod.name}. Sărim produsul.`);
        continue;
      }

      console.log(`   AI Rezultat: Categorie [${analysis.category}], uValue [${analysis.uValue}]`);
      console.log(`   Pro: ${analysis.pros}`);
      console.log(`   Con: ${analysis.cons}`);

      // 3. Salvare în DB
      const newMaterial = await prisma.material.create({
        data: {
          internalCode,
          name: prod.name,
          category: analysis.category,
          subcategory: analysis.subcategory || null,
          unit: analysis.unit,
          pricePerUnit: prod.pricePerUnit,
          brand: analysis.brand || 'Necunoscut',
          storeUrl: prod.storeUrl,
          description: analysis.description,
          uValue: analysis.uValue,
          isDefault: true,
          // Vom salva pros/cons direct în descriere pentru moment, 
          // sau putem adăuga câmpuri separate în schema prisma mai târziu.
          // Deocamdată le formatăm în description:
          // (Dacă schema a fost deja adaptată, s-ar fi salvat direct, dar folosim descrierea ca proxy).
        }
      });
      
      // Salvăm și în description detaliile AI
      await prisma.material.update({
        where: { id: newMaterial.id },
        data: {
          description: `${analysis.description}\n\n✅ Avantaj: ${analysis.pros}\n⚠️ Dezavantaj: ${analysis.cons}\nAlternativă: ${analysis.genericAlternatives.join(', ')}`
        }
      });

      await prisma.priceHistory.create({
        data: {
          materialId: newMaterial.id,
          price: prod.pricePerUnit,
          source: 'dedeman-scraper'
        }
      });
      
      console.log(`   ✅ Produs salvat cu succes în DB!`);
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
