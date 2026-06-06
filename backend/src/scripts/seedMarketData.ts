/**
 * backend/src/scripts/seedMarketData.ts
 *
 * Parsează exportPivot_CNS107D (1).csv și populează tabelul MarketIndexPoint.
 * Script idempotent — poate fi re-rulat fără efecte secundare (skipDuplicates).
 *
 * Execuție: npm run seed:market
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Mapare luni românești → număr 1-12 ────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  ianuarie: 1, februarie: 2, martie: 3, aprilie: 4,
  mai: 5, iunie: 6, iulie: 7, august: 8,
  septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12,
};

// ─── Mapare tip categorie CSV → cheie internă ──────────────────────────────
function mapCategory(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'cladiri rezidentiale') return 'rezidential';
  if (normalized === 'cladiri nerezidentiale') return 'nerezidential';
  if (normalized === 'cladiri') return 'total_cladiri';
  if (normalized === 'total cost materiale') return 'total_materiale';
  return null; // linie necunoscută — skip
}

/**
 * Parsează o linie CSV de forma:
 *   "Cladiri rezidentiale, Luna ianuarie 2005, Procente, 38.6"
 * și returnează { year, month, category, indexValue } sau null dacă invalid.
 */
function parseLine(line: string): {
  year: number;
  month: number;
  category: string;
  indexValue: number;
} | null {
  const parts = line.split(',').map(p => p.trim());
  if (parts.length < 4) return null;

  const [rawCategory, rawMonth, , rawValue] = parts;

  const category = mapCategory(rawCategory);
  if (!category) return null;

  // "Luna ianuarie 2005" → month=1, year=2005
  const monthMatch = rawMonth.toLowerCase().match(/luna\s+(\w+)\s+(\d{4})/);
  if (!monthMatch) return null;

  const month = MONTH_MAP[monthMatch[1]];
  const year = parseInt(monthMatch[2], 10);
  if (!month || isNaN(year)) return null;

  const indexValue = parseFloat(rawValue);
  if (isNaN(indexValue)) return null;

  return { year, month, category, indexValue };
}

async function main() {
  const csvPath = path.join(
    __dirname,
    '../data/exportPivot_CNS107D (1).csv'
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`[seedMarketData] Fișierul CSV nu a fost găsit: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').slice(1); // skip header line

  const records: { year: number; month: number; category: string; indexValue: number }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed) {
      records.push(parsed);
    }
  }

  console.log(`[seedMarketData] Parsate ${records.length} puncte de date din CSV.`);

  // Batch insert cu skipDuplicates — idempotent
  const result = await prisma.marketIndexPoint.createMany({
    data: records,
    skipDuplicates: true,
  });

  console.log(`[seedMarketData] ✓ Inserate ${result.count} puncte noi în MarketIndexPoint.`);
  console.log(`[seedMarketData] ✓ Skip-uite ${records.length - result.count} duplicate (deja existente).`);

  // Sumarul categoriilor inserate
  const summary = await prisma.marketIndexPoint.groupBy({
    by: ['category'],
    _count: { id: true },
    _min: { year: true },
    _max: { year: true },
  });

  console.log('\n[seedMarketData] Sumar per categorie:');
  for (const s of summary) {
    console.log(`  • ${s.category}: ${s._count.id} puncte (${s._min.year}–${s._max.year})`);
  }
}

main()
  .catch(e => {
    console.error('[seedMarketData] Eroare fatală:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
