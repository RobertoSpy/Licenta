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
const client_1 = require("@prisma/client");
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
const ragService_1 = require("../modules/ai/services/ragService");
function mockSearchRag(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const content = yield ragService_1.ragService.searchRelevantMaterialChunks(query);
        return [{ content }];
    });
}
function extractAndSeedMetadata() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        console.log('[ExtractMetadata] Incepere proces...');
        // Doar materialele ne-verificate care nu au date
        const materials = yield prisma.material.findMany({
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
            const ragChunks = yield mockSearchRag(`${material.name} uValue transmitanta termica rezistenta compresiune`);
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
                const response = yield ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { temperature: 0.1, responseMimeType: 'application/json' }
                });
                const rawText = response.text || '{}';
                const extracted = JSON.parse(rawText);
                // 3. Salvează în BD
                if (extracted.uValue || extracted.compressiveStrength) {
                    yield prisma.material.update({
                        where: { id: material.id },
                        data: {
                            uValue: (_a = extracted.uValue) !== null && _a !== void 0 ? _a : undefined,
                            compressiveStrength: (_b = extracted.compressiveStrength) !== null && _b !== void 0 ? _b : undefined,
                            minSeismicZone: (_c = extracted.minSeismicZone) !== null && _c !== void 0 ? _c : undefined,
                            maxFloors: (_d = extracted.maxFloors) !== null && _d !== void 0 ? _d : undefined,
                            normativeCode: (_e = extracted.normativeCode) !== null && _e !== void 0 ? _e : undefined,
                            extractionConfidence: (_f = extracted.extractionConfidence) !== null && _f !== void 0 ? _f : undefined,
                            extractionSource: 'RAG Automated Extraction'
                        }
                    });
                    console.log(`✅ ${material.name}: actualizat cu succes (încredere: ${extracted.extractionConfidence})`);
                }
                else {
                    console.warn(`⚠️ ${material.name}: AI nu a găsit valori numerice`);
                }
            }
            catch (err) {
                console.error(`❌ Eroare la ${material.name}:`, err.message);
            }
            yield sleep(2000); // Rate limiting
        }
        console.log('[ExtractMetadata] Proces finalizat.');
    });
}
if (require.main === module) {
    extractAndSeedMetadata()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}
