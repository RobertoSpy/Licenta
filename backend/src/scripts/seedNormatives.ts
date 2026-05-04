import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pdfParse = require('pdf-parse');

import { PrismaClient } from '@prisma/client';
import { embeddingService } from '../services/ai/embeddingService';

const prisma = new PrismaClient();

/**
 * Mapping de agent per fisier PDF.
 * Doar aceste 5 documente sunt indexate pentru Faza 1.
 * Adauga mai multe fisiere aici cand incepi Faza 2+.
 */
const AGENT_MAP: Record<string, string> = {
  'III_26_NP_112_2014.pdf':  'geotehnic',  // NP112 - Fundatii si sol
  'NP_074-2022_.pdf':        'geotehnic',  // NP074 - Studii geotehnice
  'I_22_P100_1_2013.pdf':    'seismic',   // P100-1 - Cod seismic
  'Lege 50 1991(r2).pdf':    'legal',     // Legea 50 - Autorizatii
  'Lege 350 2001.pdf':       'legal',     // Legea 350 - Urbanism
};

// Oprim la 15 calls / request sau punem sleep pentru a nu depasi cota gratuita Gemini API
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Împarte textul masiv într-un array de texte mai mici.
 * Ideal chunkSize să fie între 500 - 1000 de cuvinte. (aici dăm split la 2500 caractere, care vin aprox 400 cuvinte).
 */
function chunkText(text: string, chunkSize: number = 2500, overlap: number = 300): string[] {
  const chunks: string[] = [];
  let i = 0;
  
  // Clean text from excessive new lines and spaces
  const cleanText = text.replace(/\s+/g, ' ').trim();

  while (i < cleanText.length) {
    let end = i + chunkSize;
    
    // Asigura-te ca nu tăiem cuvântul pe din două (mergem pană la ultimul spațiu)
    if (end < cleanText.length) {
      const lastSpaceIdx = cleanText.lastIndexOf(' ', end);
      if (lastSpaceIdx > i) {
        end = lastSpaceIdx;
      }
    }
    
    chunks.push(cleanText.slice(i, end));
    
    // Overlap ajută AI-ul la search să nu piardă contextul între pasaje tăiate.
    i = end - overlap; 
  }
  return chunks;
}

async function processPdf(filePath: string) {
  const fileName = path.basename(filePath);
  console.log(`\n⏳ Încep procesarea pentru: ${fileName}`);
  
  const dataBuffer = fs.readFileSync(filePath);
  
  try {
    const pdfData = await pdfParse(dataBuffer);
    const rawText = pdfData.text;
    
    console.log(`- Extrase ${rawText.length} caractere din PDF.`);
    
    const chunks = chunkText(rawText, 3000, 400); 
    console.log(`- Împărțit în ${chunks.length} chunks. Începem generarea de Emeddings (Vectorizare)...`);

    let embeddedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
        // Punem chapter ca fiind primele cuvinte din fisier/chunk in lipsa Parsing-ului smart PDF
        const snippetTitle = `${fileName} - Fragment ${i + 1}`;
        const content = chunks[i];

        try {
            // Trimitem fragmentul la Google Gemini (Genereaza lista matematica)
            const vector = await embeddingService.embed(content);
            const vectorStr = `[${vector.join(',')}]`;
            const agentName = AGENT_MAP[fileName] || 'general';

            // Prisma nu expune direct insert pe campul de vector, deci operam prin SQL brut:
            await prisma.$executeRawUnsafe(
               `INSERT INTO "NormativeChunk" ("source", "chapter", "content", "agent", "embedding") 
                VALUES ($1, $2, $3, $4, $5::vector)`,
               fileName, snippetTitle, content, agentName, vectorStr
            );
            embeddedCount++;

            process.stdout.write(`\r- Procesat și salvat: ${embeddedCount}/${chunks.length}`);
            
            // Limitare pentru free-tier la Gemini: (~15 calls per min allowed depending on limits, vom aștepta 3 secunde)
            await sleep(3500); 

        } catch (embErr: any) {
            console.error(`\n❌ EROARE la chunk-ul ${i+1} din ${fileName}:`, embErr.message);
            // Dacă prinzi "429 Too Many Requests" e de la limitare. Te oprești sau aștepți f mult.
            if(embErr?.status === 429) {
                console.log("Atenție: Limitare Gemini (429). Aștept 30s...");
                await sleep(30000);
            }
        }
    }

    console.log(`\n✅ ${fileName} a fost salvat complet ca RAG Knowledge în Bază!`);

  } catch (pdfErr) {
     console.error(`Eroare la parsare PDF file ${fileName}:`, pdfErr);
  }
}

async function main() {
    const docsDir = path.join(__dirname, '../../docsAI');
    if (!fs.existsSync(docsDir)) {
        console.error(`Folderul ${docsDir} nu există.`);
        return;
    }

    const allFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
    
    // Filtram doar documentele din AGENT_MAP (cele 5 prioritare pentru Faza 1)
    const files = allFiles.filter(f => AGENT_MAP[f]);
    const skipped = allFiles.filter(f => !AGENT_MAP[f]);

    if (skipped.length > 0) {
      console.log(`Sarite (nu sunt in AGENT_MAP): ${skipped.join(', ')}`);
    }
    
    if (files.length === 0) {
        console.log(`Nu s-au găsit documente PDF în folderul ${docsDir}`);
        return;
    }

    console.log(`Găsite ${files.length} documente pentru indexare.`);

    for(const file of files) {
        const fullPath = path.join(docsDir, file);
        await processPdf(fullPath);
    }
    
    console.log("\n🚀 OPERAȚIUNE DE SEED COMPLETA.");
}

main()
  .catch(e => {
    console.error("Eroare neprevăzută în script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
