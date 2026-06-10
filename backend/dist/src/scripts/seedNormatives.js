"use strict";
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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const pdfParse = require('pdf-parse');
const embeddingService_1 = require("../modules/ai/services/embeddingService");
const normative_registry_1 = require("../data/normative-registry");
const prisma_1 = require("../lib/prisma");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// ─────────────────────────────────────────────────────────────────
// DETECTARE AGENT per secțiune
// ─────────────────────────────────────────────────────────────────
function detectAgent(sectionText, config) {
    const sample = sectionText.slice(0, 300);
    for (const rule of config.agentRules) {
        if (rule.pattern.test(sample))
            return rule.agent;
    }
    return config.defaultAgent;
}
function detectApplicability(sectionText, source) {
    if (source === 'Legea114-1996' || source === 'NP057-2002')
        return 'residential';
    const commercialKeywords = /comercial|public|birou|hotel|restaurant|spital|sala|spectatori|magazin|depozit|industrie|institutie/i;
    const residentialKeywords = /locuint|locuință|casa|casă|apartament|dormitor|bucatarie|bucătărie|baie|garsonier/i;
    const sample = sectionText.slice(0, 400);
    const hasCommercial = commercialKeywords.test(sample);
    const hasResidential = residentialKeywords.test(sample);
    if (hasCommercial && !hasResidential)
        return 'commercial';
    if (hasResidential && !hasCommercial)
        return 'residential';
    return 'mixed';
}
// ─────────────────────────────────────────────────────────────────
// SPLIT LA PARAGRAFE COMPLETE
// ─────────────────────────────────────────────────────────────────
function splitAtParagraphs(text, baseTitle, agent, applicability, maxWords) {
    const result = [];
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
        }
        else {
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
function semanticChunk(text, source) {
    var _a, _b;
    const config = normative_registry_1.NORMATIVE_REGISTRY[source];
    if (!config)
        throw new Error(`Normativ necunoscut în registry: ${source}`);
    const chunks = [];
    const headerPattern = /(?=\n\s*(?:\d+\.\d+(?:\.\d+(?:\.\d+)?)?|Art(?:icolul?)?\.?\s*\d+|CAPITOLUL\s+(?:\d+|[IVX]+)|Cap(?:itolul?)?\.?\s+(?:\d+|[IVX]+)|Anexa\s+(?:[Nn]r\.)?\s*[A-Z\d]+|[A-G]\.\s+[A-Z])[^\n]*\n)/gi;
    const rawSections = text.split(headerPattern).filter(s => s.trim().length > 0);
    for (const section of rawSections) {
        const trimmed = section.trim();
        if (trimmed.length === 0)
            continue;
        const firstLine = (_b = (_a = trimmed
            .split('\n')
            .find(l => l.trim().length > 0)) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : 'Secțiune';
        const shouldSkip = config.skipPatterns.some(p => p.test(firstLine));
        if (shouldSkip)
            continue;
        const wordCount = trimmed.split(/\s+/).length;
        if (wordCount < 30)
            continue;
        const agent = detectAgent(trimmed, config);
        const applicability = detectApplicability(trimmed, source);
        if (wordCount > 900) {
            const subChunks = splitAtParagraphs(trimmed, firstLine, agent, applicability, 900);
            chunks.push(...subChunks);
        }
        else {
            chunks.push({ title: firstLine, content: trimmed, agent, applicability });
        }
    }
    return chunks;
}
// ─────────────────────────────────────────────────────────────────
// SEED — procesare PDF → chunks → embeddings → DB (cu Resume Logic)
// ─────────────────────────────────────────────────────────────────
function seedNormative(filePath, source, force) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log(`\n📄 Procesez: ${source} (${path_1.default.basename(filePath)})`);
        if (!fs_1.default.existsSync(filePath))
            return;
        const extension = path_1.default.extname(filePath).toLowerCase();
        let cleanedText = '';
        if (extension === '.md' || extension === '.txt') {
            cleanedText = fs_1.default.readFileSync(filePath, 'utf-8');
        }
        else {
            const pdfBuffer = fs_1.default.readFileSync(filePath);
            const parsed = yield pdfParse(pdfBuffer);
            cleanedText = parsed.text;
        }
        cleanedText = cleanedText.replace(/\u0000/g, '');
        const chunks = semanticChunk(cleanedText, source);
        let startOffset = 0;
        if (!force) {
            const count = yield prisma_1.prisma.normativeChunk.count({ where: { source } });
            if (count > 0) {
                console.log(`  🔄 Resume: S-au găsit ${count} chunks deja salvate. Sar peste.`);
                startOffset = count;
            }
        }
        else {
            yield prisma_1.prisma.normativeChunk.deleteMany({ where: { source } });
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
                    const vectorArray = yield embeddingService_1.embeddingService.embed(chunk.content);
                    yield prisma_1.prisma.$executeRawUnsafe(`INSERT INTO "NormativeChunk" ("source", "chapter", "content", "agent", "status", "applicability", "embedding")
           VALUES ($1, $2, $3, $4, 'in_vigoare', $5, $6::vector)`, source, chunk.title, chunk.content, chunk.agent, chunk.applicability, `[${vectorArray.join(',')}]`);
                    break;
                }
                catch (err) {
                    if ((err === null || err === void 0 ? void 0 : err.status) === 429 || ((_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.includes('429'))) {
                        retries++;
                        const delay = Math.min(30000 * retries, 120000); // 30s → 60s → 90s → 120s
                        console.warn(`  ⏳ Rate limit (429). Retry ${retries}/5 în ${delay / 1000}s...`);
                        yield sleep(delay);
                    }
                    else {
                        console.error(`  ❌ Eroare la chunk ${i}:`, err.message);
                        break;
                    }
                }
            }
            if ((i + 1) % 10 === 0) {
                console.log(`  ⏳ Progress: ${i + 1}/${chunks.length} (${i + 1 - startOffset} noi în sesiunea asta)`);
            }
            // 1500ms între request-uri = ~40 req/min, safe sub limita free-tier de 100 RPM
            yield sleep(1500);
        }
    });
}
// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const force = process.argv.includes('--force');
        console.log(`🚀 Seed normative — START${force ? ' (FORCE MODE)' : ''}\n`);
        const docsDir = path_1.default.join(__dirname, '../../docsAI');
        if (!fs_1.default.existsSync(docsDir)) {
            console.error(`❌ Folderul docsAI nu există la: ${docsDir}`);
            process.exit(1);
        }
        // Procesăm doar normativele care au fișierul pe disc
        const sourceArgIndex = process.argv.indexOf('--source');
        const targetSource = sourceArgIndex !== -1 ? process.argv[sourceArgIndex + 1] : null;
        const entries = Object.entries(normative_registry_1.NORMATIVE_FILES);
        const toProcess = entries.filter(([source, file]) => {
            if (!file)
                return false;
            if (targetSource && source !== targetSource)
                return false;
            return fs_1.default.existsSync(path_1.default.join(docsDir, file));
        });
        const missing = entries.filter(([, file]) => {
            if (!file)
                return false;
            return !fs_1.default.existsSync(path_1.default.join(docsDir, file));
        });
        if (missing.length > 0) {
            console.log(`⚠️  Normative fără fișier în docsAI/:`);
            missing.forEach(([source, file]) => console.log(`  - ${source}: ${file || '(nespecificat)'}`));
        }
        console.log(`\n📋 Normative de procesat: ${toProcess.length}\n`);
        for (const [source, file] of toProcess) {
            yield seedNormative(path_1.default.join(docsDir, file), source, force);
        }
        // Statistici finale în DB
        console.log('\n📊 Statistici finale în DB:');
        const stats = yield prisma_1.prisma.$queryRaw `
    SELECT agent, source, COUNT(*) as chunks
    FROM "NormativeChunk"
    GROUP BY agent, source
    ORDER BY agent, source
  `;
        console.table(stats.map((s) => ({
            agent: s.agent,
            source: s.source,
            chunks: Number(s.chunks),
        })));
        yield prisma_1.prisma.$disconnect();
        console.log('\n✅ Seed complet.');
    });
}
main().catch((err) => __awaiter(void 0, void 0, void 0, function* () {
    console.error('❌ Seed eșuat:', err);
    yield prisma_1.prisma.$disconnect();
    process.exit(1);
}));
