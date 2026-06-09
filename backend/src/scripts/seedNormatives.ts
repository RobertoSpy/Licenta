import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pdfParse = require('pdf-parse');

import { embeddingService } from '../modules/ai/services/embeddingService';
import {
  NORMATIVE_REGISTRY,
  NORMATIVE_FILES,
  AgentType,
  NormativeConfig,
} from '../data/normative-registry';

import { prisma } from '../lib/prisma';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

interface SemanticChunk {
  title: string;
  content: string;
  agent: AgentType;
  applicability: 'residential' | 'commercial' | 'mixed';
}

// ─────────────────────────────────────────────────────────────────
// DETECTARE AGENT per secțiune
// ─────────────────────────────────────────────────────────────────

function detectAgent(sectionText: string, config: NormativeConfig): AgentType {
  const sample = sectionText.slice(0, 300);
  for (const rule of config.agentRules) {
    if (rule.pattern.test(sample)) return rule.agent;
  }
  return config.defaultAgent;
}

function detectApplicability(sectionText: string, source: string): 'residential' | 'commercial' | 'mixed' {
  if (source === 'Legea114-1996' || source === 'NP057-2002') return 'residential';

  const commercialKeywords = /comercial|public|birou|hotel|restaurant|spital|sala|spectatori|magazin|depozit|industrie|institutie/i;
  const residentialKeywords = /locuint|locuință|casa|casă|apartament|dormitor|bucatarie|bucătărie|baie|garsonier/i;

  const sample = sectionText.slice(0, 400);
  const hasCommercial = commercialKeywords.test(sample);
  const hasResidential = residentialKeywords.test(sample);

  if (hasCommercial && !hasResidential) return 'commercial';
  if (hasResidential && !hasCommercial) return 'residential';

  return 'mixed';
}

// ─────────────────────────────────────────────────────────────────
// SPLIT LA PARAGRAFE COMPLETE
// ─────────────────────────────────────────────────────────────────

function splitAtParagraphs(
  text: string,
  baseTitle: string,
  agent: AgentType,
  applicability: 'residential' | 'commercial' | 'mixed',
  maxWords: number
): SemanticChunk[] {
  const result: SemanticChunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  let buffer = '';
  let part = 1;

  for (const para of paragraphs) {
    const combined = buffer + '\n\n' + para;
    if (buffer.length > 0 && combined.split(/\s+/).length > maxWords) {
      result.push({
        title: part === 1 ? baseTitle : `${baseTitle} (partea ${part})`,
        content: buffer.trim(),
        agent,
        applicability,
      });
      buffer = para;
      part++;
    } else {
      buffer = combined;
    }
  }

  if (buffer.trim().split(/\s+/).length >= 30) {
    result.push({
      title: part === 1 ? baseTitle : `${baseTitle} (partea ${part})`,
      content: buffer.trim(),
      agent,
      applicability,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────
// SEMANTIC CHUNKER — CORE
// ─────────────────────────────────────────────────────────────────

function semanticChunk(text: string, source: string): SemanticChunk[] {
  const config = NORMATIVE_REGISTRY[source];
  if (!config) throw new Error(`Normativ necunoscut în registry: ${source}`);

  const chunks: SemanticChunk[] = [];
  const headerPattern =
    /(?=\n\s*(?:\d+\.\d+(?:\.\d+(?:\.\d+)?)?|Art(?:icolul?)?\.?\s*\d+|CAPITOLUL\s+(?:\d+|[IVX]+)|Cap(?:itolul?)?\.?\s+(?:\d+|[IVX]+)|Anexa\s+(?:[Nn]r\.)?\s*[A-Z\d]+|[A-G]\.\s+[A-Z])[^\n]*\n)/gi;

  const rawSections = text.split(headerPattern).filter(s => s.trim().length > 0);

  for (const section of rawSections) {
    const trimmed = section.trim();
    if (trimmed.length === 0) continue;

    const firstLine =
      trimmed
        .split('\n')
        .find(l => l.trim().length > 0)
        ?.trim() ?? 'Secțiune';

    const shouldSkip = config.skipPatterns.some(p => p.test(firstLine));
    if (shouldSkip) continue;

    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 30) continue;

    const agent = detectAgent(trimmed, config);
    const applicability = detectApplicability(trimmed, source);

    if (wordCount > 900) {
      const subChunks = splitAtParagraphs(trimmed, firstLine, agent, applicability, 900);
      chunks.push(...subChunks);
    } else {
      chunks.push({ title: firstLine, content: trimmed, agent, applicability });
    }
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────
// SEED — procesare PDF → chunks → embeddings → DB (cu Resume Logic)
// ─────────────────────────────────────────────────────────────────

async function seedNormative(filePath: string, source: string, force: boolean): Promise<void> {
  console.log(`\n📄 Procesez: ${source} (${path.basename(filePath)})`);

  if (!fs.existsSync(filePath)) return;

  const extension = path.extname(filePath).toLowerCase();
  let cleanedText = '';

  if (extension === '.md' || extension === '.txt') {
    cleanedText = fs.readFileSync(filePath, 'utf-8');
  } else {
    const pdfBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(pdfBuffer);
    cleanedText = parsed.text;
  }

  cleanedText = cleanedText.replace(/\u0000/g, '');
  const chunks = semanticChunk(cleanedText, source);

  let startOffset = 0;
  if (!force) {
    const count = await prisma.normativeChunk.count({ where: { source } });
    if (count > 0) {
      console.log(`  🔄 Resume: S-au găsit ${count} chunks deja salvate. Sar peste.`);
      startOffset = count;
    }
  } else {
    await prisma.normativeChunk.deleteMany({ where: { source } });
    console.log(`  ⚡ Force re-seed: Am șters chunks existente.`);
  }

  if (startOffset >= chunks.length) {
    console.log(`  ✅ Deja complet.`);
    return;
  }

  for (let i = startOffset; i < chunks.length; i++) {
    const chunk = chunks[i];
    let retries = 0;

    while (retries < 5) {
      try {
        const vectorArray = await embeddingService.embed(chunk.content);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "NormativeChunk" ("source", "chapter", "content", "agent", "status", "applicability", "embedding")
           VALUES ($1, $2, $3, $4, 'in_vigoare', $5, $6::vector)`,
          source, chunk.title, chunk.content, chunk.agent, chunk.applicability, `[${vectorArray.join(',')}]`
        );
        break;
      } catch (err: any) {
        if (err?.status === 429 || err?.message?.includes('429')) {
          retries++;
          const delay = Math.min(30_000 * retries, 120_000); // 30s → 60s → 90s → 120s
          console.warn(`  ⏳ Rate limit (429). Retry ${retries}/5 în ${delay / 1000}s...`);
          await sleep(delay);
        } else {
          console.error(`  ❌ Eroare la chunk ${i}:`, err.message);
          break;
        }
      }
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ⏳ Progress: ${i + 1}/${chunks.length} (${i + 1 - startOffset} noi în sesiunea asta)`);
    }

    // 1500ms între request-uri = ~40 req/min, safe sub limita free-tier de 100 RPM
    await sleep(1500);
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  console.log(`🚀 Seed normative — START${force ? ' (FORCE MODE)' : ''}\n`);

  const docsDir = path.join(__dirname, '../../docsAI');

  if (!fs.existsSync(docsDir)) {
    console.error(`❌ Folderul docsAI nu există la: ${docsDir}`);
    process.exit(1);
  }

  // Procesăm doar normativele care au fișierul pe disc
  const sourceArgIndex = process.argv.indexOf('--source');
  const targetSource = sourceArgIndex !== -1 ? process.argv[sourceArgIndex + 1] : null;

  const entries = Object.entries(NORMATIVE_FILES);
  const toProcess = entries.filter(([source, file]) => {
    if (!file) return false;
    if (targetSource && source !== targetSource) return false;
    return fs.existsSync(path.join(docsDir, file));
  });

  const missing = entries.filter(([, file]) => {
    if (!file) return false;
    return !fs.existsSync(path.join(docsDir, file));
  });

  if (missing.length > 0) {
    console.log(`⚠️  Normative fără fișier în docsAI/:`);
    missing.forEach(([source, file]) => console.log(`  - ${source}: ${file || '(nespecificat)'}`));
  }

  console.log(`\n📋 Normative de procesat: ${toProcess.length}\n`);

  for (const [source, file] of toProcess) {
    await seedNormative(path.join(docsDir, file), source, force);
  }

  // Statistici finale în DB
  console.log('\n📊 Statistici finale în DB:');
  const stats = await prisma.$queryRaw<Array<{ agent: string; source: string; chunks: bigint }>>`
    SELECT agent, source, COUNT(*) as chunks
    FROM "NormativeChunk"
    GROUP BY agent, source
    ORDER BY agent, source
  `;
  console.table(
    (stats as any[]).map((s: any) => ({
      agent: s.agent,
      source: s.source,
      chunks: Number(s.chunks),
    }))
  );

  await prisma.$disconnect();
  console.log('\n✅ Seed complet.');
}

main().catch(async err => {
  console.error('❌ Seed eșuat:', err);
  await prisma.$disconnect();
  process.exit(1);
});
