import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pdfParse = require('pdf-parse');

import { embeddingService } from '../services/ai/embeddingService';
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

// ─────────────────────────────────────────────────────────────────
// SPLIT LA PARAGRAFE COMPLETE
// ─────────────────────────────────────────────────────────────────

function splitAtParagraphs(
  text: string,
  baseTitle: string,
  agent: AgentType,
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
    /(?=\n(?:\d+\.\d+(?:\.\d+(?:\.\d+)?)?|Art(?:icolul?)?\s*\d+|CAPITOLUL\s+(?:\d+|[IVX]+)|Anexa\s+[A-Z\d]+)[^\n]*\n)/gi;

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

    if (wordCount > 900) {
      const subChunks = splitAtParagraphs(trimmed, firstLine, agent, 900);
      chunks.push(...subChunks);
    } else {
      chunks.push({ title: firstLine, content: trimmed, agent });
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

  const pdfBuffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(pdfBuffer);
  const cleanedText = parsed.text.replace(/\u0000/g, '');
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
          `INSERT INTO "NormativeChunk" ("source", "chapter", "content", "agent", "status", "embedding")
           VALUES ($1, $2, $3, $4, 'in_vigoare', $5::vector)`,
          source, chunk.title, chunk.content, chunk.agent, `[${vectorArray.join(',')}]`
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
  const entries = Object.entries(NORMATIVE_FILES);
  const toProcess = entries.filter(([, file]) => {
    if (!file) return false;
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
