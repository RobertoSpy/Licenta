import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pdfParse = require('pdf-parse');

import { PrismaClient } from '@prisma/client';
import { embeddingService } from '../services/ai/embeddingService';

const prisma = new PrismaClient();

// ============================================================
// NORMATIVE CONFIG — Sursă unică de adevăr pentru indexare
// Adaugă documente noi DOAR aici. Nu modifica logica de procesare.
//
// Câmpuri:
//   file   — numele exact al fișierului PDF din folderul docsAI/
//   source — identificatorul normativului (afișat în răspunsuri AI)
//   agent  — agentul RAG responsabil ('geotehnic'|'seismic'|'legal'|'structural'|'materiale'|'deviz')
//   status — starea normativului ('in_vigoare'|'in_revizuire'|'abrogat')
// ============================================================
const NORMATIVE_CONFIG: Array<{
  file: string;
  source: string;
  agent: string;
  status: 'in_vigoare' | 'in_revizuire' | 'abrogat';
}> = [
  // ── AGENT: legal ──────────────────────────────────────────
  { file: 'Legea-10-1995.pdf',     source: 'Legea-10-1995',    agent: 'legal',      status: 'in_vigoare' },
  { file: 'Legea-50-1991.pdf',     source: 'Legea-50-1991',    agent: 'legal',      status: 'in_vigoare' },
  { file: 'Legea-114-1996.pdf',    source: 'Legea-114-1996',   agent: 'legal',      status: 'in_vigoare' },
  // Compatibilitate cu vechile denumiri ale fișierelor
  { file: 'Lege 50 1991(r2).pdf',  source: 'Legea-50-1991',    agent: 'legal',      status: 'in_vigoare' },
  { file: 'Lege 350 2001.pdf',     source: 'Legea-350-2001',   agent: 'legal',      status: 'in_vigoare' },

  // ── AGENT: seismic ────────────────────────────────────────
  { file: 'P100-1-2013.pdf',       source: 'P100-1-2013',      agent: 'seismic',    status: 'in_vigoare' },
  { file: 'I_22_P100_1_2013.pdf',  source: 'P100-1-2013',      agent: 'seismic',    status: 'in_vigoare' },
  // P100-1/2025 — NU indexa: în redactare, va înlocui P100-1/2013

  // ── AGENT: geotehnic ──────────────────────────────────────
  { file: 'NP112-2014.pdf',        source: 'NP112-2014',       agent: 'geotehnic',  status: 'in_vigoare' },
  { file: 'III_26_NP_112_2014.pdf',source: 'NP112-2014',       agent: 'geotehnic',  status: 'in_vigoare' },
  { file: 'NP_074-2022_.pdf',      source: 'NP074-2022',       agent: 'geotehnic',  status: 'in_vigoare' },

  // ── AGENT: structural ─────────────────────────────────────
  { file: 'CR6-2013.pdf',          source: 'CR6-2013',         agent: 'structural', status: 'in_vigoare' },
  { file: 'CR1-1-3-2012.pdf',      source: 'CR1-1-3-2012',     agent: 'structural', status: 'in_vigoare' },
  { file: 'CR1-1-4-2012.pdf',      source: 'CR1-1-4-2012',     agent: 'structural', status: 'in_vigoare' },
  { file: 'NE012-1-2022.pdf',      source: 'NE012-1-2022',     agent: 'structural', status: 'in_vigoare' },
  { file: 'C56-2002.pdf',          source: 'C56-2002',         agent: 'structural', status: 'in_vigoare' },

  // ── AGENT: materiale ──────────────────────────────────────
  // TODO Faza 2: web-scraping Leroy Merlin, Dedeman, Bricostore
  // { file: 'catalog-materiale-2024.pdf', source: 'Catalog-Materiale', agent: 'materiale', status: 'in_vigoare' },

  // ── AGENT: deviz ──────────────────────────────────────────
  { file: 'P91-URBAN-INCERC.pdf',  source: 'P91-INCERC',       agent: 'deviz',      status: 'in_vigoare' },
];

// ============================================================

// Throttle pentru free-tier Gemini API (~15 calls/min)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Împarte textul masiv în chunks de ~2500 caractere cu overlap de 400 caractere.
 * Overlap-ul previne pierderea contextului la granița dintre chunk-uri.
 */
function chunkText(text: string, chunkSize: number = 2500, overlap: number = 400): string[] {
  const chunks: string[] = [];
  let i = 0;

  const cleanText = text.replace(/\s+/g, ' ').trim();

  while (i < cleanText.length) {
    let end = i + chunkSize;

    if (end < cleanText.length) {
      const lastSpaceIdx = cleanText.lastIndexOf(' ', end);
      if (lastSpaceIdx > i) {
        end = lastSpaceIdx;
      }
    }

    chunks.push(cleanText.slice(i, end));
    i = end - overlap;
  }
  return chunks;
}

async function processPdf(filePath: string, config: typeof NORMATIVE_CONFIG[0]) {
  const fileName = path.basename(filePath);
  console.log(`\n⏳ [${config.agent.toUpperCase()}] Procesez: ${fileName} (${config.source})`);

  const dataBuffer = fs.readFileSync(filePath);

  try {
    const pdfData = await pdfParse(dataBuffer);
    const rawText = pdfData.text;

    console.log(`  ↳ Extras ${rawText.length} caractere. Chunkuiesc și vectorizez...`);

    const chunks = chunkText(rawText, 3000, 400);
    console.log(`  ↳ ${chunks.length} chunk-uri de procesat.`);

    let embeddedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const snippetTitle = `${config.source} - Fragment ${i + 1}/${chunks.length}`;
      const content = chunks[i];

      try {
        const vector = await embeddingService.embed(content);
        const vectorStr = `[${vector.join(',')}]`;

        // INSERT cu câmpul status inclus
        await prisma.$executeRawUnsafe(
          `INSERT INTO "NormativeChunk" ("source", "chapter", "content", "agent", "status", "embedding") 
           VALUES ($1, $2, $3, $4, $5, $6::vector)`,
          config.source, snippetTitle, content, config.agent, config.status, vectorStr
        );
        embeddedCount++;

        process.stdout.write(`\r  ↳ Progres: ${embeddedCount}/${chunks.length} chunk-uri salvate`);

        // Rate limiting: 3.5s între apeluri pentru free-tier Gemini
        await sleep(3500);

      } catch (embErr: any) {
        console.error(`\n❌ EROARE la chunk-ul ${i + 1} din ${fileName}:`, embErr.message);
        if (embErr?.status === 429) {
          console.log('⏳ Limitat de Gemini (429). Aștept 30s...');
          await sleep(30000);
        }
      }
    }

    console.log(`\n✅ ${config.source} [${config.agent}] — ${embeddedCount}/${chunks.length} chunk-uri indexate.`);

  } catch (pdfErr) {
    console.error(`❌ Eroare la parsare PDF ${fileName}:`, pdfErr);
  }
}

async function main() {
  const docsDir = path.join(__dirname, '../../docsAI');

  if (!fs.existsSync(docsDir)) {
    console.error(`❌ Folderul docsAI nu există la: ${docsDir}`);
    console.error('  → Creează folderul și pune PDF-urile în el.');
    return;
  }

  const availableFiles = new Set(fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf')));

  // Găsim toate config-urile pentru care există fișierul pe disc
  const toProcess = NORMATIVE_CONFIG.filter(cfg => availableFiles.has(cfg.file));
  const missing = NORMATIVE_CONFIG.filter(cfg => !availableFiles.has(cfg.file));

  if (missing.length > 0) {
    console.log(`\n⚠️  Fișiere din NORMATIVE_CONFIG care lipsesc din docsAI/:`);
    missing.forEach(cfg => console.log(`  - ${cfg.file} [${cfg.agent}]`));
  }

  if (toProcess.length === 0) {
    console.log('\n❌ Nu s-au găsit fișiere PDF care să corespundă NORMATIVE_CONFIG.');
    return;
  }

  // Afișăm sumar pe agenți
  const byAgent: Record<string, string[]> = {};
  toProcess.forEach(cfg => {
    if (!byAgent[cfg.agent]) byAgent[cfg.agent] = [];
    byAgent[cfg.agent].push(cfg.source);
  });

  console.log('\n📋 Sumar indexare:');
  Object.entries(byAgent).forEach(([agent, sources]) => {
    console.log(`  [${agent}] → ${sources.join(', ')}`);
  });
  console.log(`\nTotal: ${toProcess.length} documente de indexat.\n`);

  for (const config of toProcess) {
    const fullPath = path.join(docsDir, config.file);
    await processPdf(fullPath, config);
  }

  console.log('\n🚀 SEED COMPLET. Toate normativele disponibile au fost indexate.');

  // Statistici finale
  const total = await prisma.normativeChunk.count();
  const byAgentDb = await prisma.$queryRaw<Array<{ agent: string; count: bigint }>>`
    SELECT agent, COUNT(*) as count FROM "NormativeChunk" GROUP BY agent ORDER BY count DESC
  `;
  console.log(`\n📊 Total chunk-uri în DB: ${total}`);
  byAgentDb.forEach((row: any) => {
    console.log(`  [${row.agent}]: ${row.count} chunk-uri`);
  });
}

main()
  .catch(e => {
    console.error('Eroare neprevăzută în script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
