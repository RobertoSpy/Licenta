import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import { ragService } from '../modules/ai/services/ragService';

async function mockSearchRag(query: string) {
  const content = await ragService.searchRelevantMaterialChunks(query);
  return [{ content }];
}

async function extractAndSeedMetadata() {
  console.log('[ExtractMetadata] Incepere proces...');
  
  // Doar materialele ne-verificate care nu au date
  const materials = await prisma.material.findMany({
    where: { 
      isVerified: false,
      uValue: null,
      compressiveStrength: null
    }
  });

  console.log(`[ExtractMetadata] Gasite ${materials.length} materiale de procesat.`);

  for (const material of materials) {
    console.log(`[ExtractMetadata] Procesare ${material.name}...`);
    
    // 1. Caută în RAG
    const ragChunks = await mockSearchRag(`${material.name} uValue transmitanta termica rezistenta compresiune`);
    
    if (!ragChunks.length) {
      console.warn(`[ExtractMetadata] Niciun chunk găsit pentru ${material.name}`);
      continue;
    }

    // 2. Trimite la Gemini
    const prompt = `
Din textul următor, extrage DOAR valorile numerice pentru materialul "${material.name}".
Răspunde STRICT în JSON valid, fără texte markdown, exact în acest format:
{
  "uValue": <float sau null>,
  "compressiveStrength": <float sau null>,
  "minSeismicZone": <float sau null>,
  "maxFloors": <int sau null>,
  "normativeCode": "<string sau null>",
  "extractionConfidence": <float intre 0 si 1>
}

TEXT RAG:
${ragChunks.map(c => c.content).join('\n\n')}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.1, responseMimeType: 'application/json' }
      });

      const rawText = response.text || '{}';
      const extracted = JSON.parse(rawText);

      // 3. Salvează în BD
      if (extracted.uValue || extracted.compressiveStrength) {
        await prisma.material.update({
          where: { id: material.id },
          data: {
            uValue: extracted.uValue ?? undefined,
            compressiveStrength: extracted.compressiveStrength ?? undefined,
            minSeismicZone: extracted.minSeismicZone ?? undefined,
            maxFloors: extracted.maxFloors ?? undefined,
            normativeCode: extracted.normativeCode ?? undefined,
            extractionConfidence: extracted.extractionConfidence ?? undefined,
            extractionSource: 'RAG Automated Extraction'
          }
        });
        console.log(`✅ ${material.name}: actualizat cu succes (încredere: ${extracted.extractionConfidence})`);
      } else {
        console.warn(`⚠️ ${material.name}: AI nu a găsit valori numerice`);
      }
    } catch (err: any) {
      console.error(`❌ Eroare la ${material.name}:`, err.message);
    }

    await sleep(2000); // Rate limiting
  }

  console.log('[ExtractMetadata] Proces finalizat.');
}

if (require.main === module) {
  extractAndSeedMetadata()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
