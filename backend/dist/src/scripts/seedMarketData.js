"use strict";
/**
 * backend/src/scripts/seedMarketData.ts
 *
 * Parsează exportPivot_CNS107D (1).csv și populează tabelul MarketIndexPoint.
 * Script idempotent — poate fi re-rulat fără efecte secundare (skipDuplicates).
 *
 * Execuție: npm run seed:market
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ─── Mapare luni românești → număr 1-12 ────────────────────────────────────
const MONTH_MAP = {
    ianuarie: 1, februarie: 2, martie: 3, aprilie: 4,
    mai: 5, iunie: 6, iulie: 7, august: 8,
    septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12,
};
// ─── Mapare tip categorie CSV → cheie internă ──────────────────────────────
function mapCategory(raw) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'cladiri rezidentiale')
        return 'rezidential';
    if (normalized === 'cladiri nerezidentiale')
        return 'nerezidential';
    if (normalized === 'cladiri')
        return 'total_cladiri';
    if (normalized === 'total cost materiale')
        return 'total_materiale';
    return null; // linie necunoscută — skip
}
/**
 * Parsează o linie CSV de forma:
 *   "Cladiri rezidentiale, Luna ianuarie 2005, Procente, 38.6"
 * și returnează { year, month, category, indexValue } sau null dacă invalid.
 */
function parseLine(line) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 4)
        return null;
    const [rawCategory, rawMonth, , rawValue] = parts;
    const category = mapCategory(rawCategory);
    if (!category)
        return null;
    // "Luna ianuarie 2005" → month=1, year=2005
    const monthMatch = rawMonth.toLowerCase().match(/luna\s+(\w+)\s+(\d{4})/);
    if (!monthMatch)
        return null;
    const month = MONTH_MAP[monthMatch[1]];
    const year = parseInt(monthMatch[2], 10);
    if (!month || isNaN(year))
        return null;
    const indexValue = parseFloat(rawValue);
    if (isNaN(indexValue))
        return null;
    return { year, month, category, indexValue };
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const csvPath = path_1.default.join(__dirname, '../data/exportPivot_CNS107D (1).csv');
        if (!fs_1.default.existsSync(csvPath)) {
            console.error(`[seedMarketData] Fișierul CSV nu a fost găsit: ${csvPath}`);
            process.exit(1);
        }
        const raw = fs_1.default.readFileSync(csvPath, 'utf-8');
        const lines = raw.split('\n').slice(1); // skip header line
        const records = [];
        for (const line of lines) {
            if (!line.trim())
                continue;
            const parsed = parseLine(line);
            if (parsed) {
                records.push(parsed);
            }
        }
        console.log(`[seedMarketData] Parsate ${records.length} puncte de date din CSV.`);
        // Batch insert cu skipDuplicates — idempotent
        const result = yield prisma.marketIndexPoint.createMany({
            data: records,
            skipDuplicates: true,
        });
        console.log(`[seedMarketData] ✓ Inserate ${result.count} puncte noi în MarketIndexPoint.`);
        console.log(`[seedMarketData] ✓ Skip-uite ${records.length - result.count} duplicate (deja existente).`);
        // Sumarul categoriilor inserate
        const summary = yield prisma.marketIndexPoint.groupBy({
            by: ['category'],
            _count: { id: true },
            _min: { year: true },
            _max: { year: true },
        });
        console.log('\n[seedMarketData] Sumar per categorie:');
        for (const s of summary) {
            console.log(`  • ${s.category}: ${s._count.id} puncte (${s._min.year}–${s._max.year})`);
        }
    });
}
main()
    .catch(e => {
    console.error('[seedMarketData] Eroare fatală:', e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
