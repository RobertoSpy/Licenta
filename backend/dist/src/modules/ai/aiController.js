"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiController = void 0;
exports.validateMaterialOverride = validateMaterialOverride;
const agentOrchestrator_1 = require("./services/agentOrchestrator");
const chatSummaryRepository_1 = require("./chatSummaryRepository");
const projectRepository_1 = require("../project/projectRepository");
const genai_1 = require("@google/genai");
const ragService_1 = require("./services/ragService");
const aiClient_1 = require("./services/aiClient");
// Lazy init — același pattern ca în orchestrator
let aiInstance = null;
const getAi = () => {
    if (!aiInstance)
        aiInstance = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return aiInstance;
};
exports.aiController = {
    /**
     * POST /api/ai/chat
     * Endpoint de chat pentru Zidario AI. Răspunde prin Server-Sent Events (SSE).
     * Acceptă opțional `screenContext` pentru rutare SCREEN_AGENTS.
     */
    chatStream(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            try {
                const { message, contextString, conversationHistory, screenContext, historySummary } = req.body;
                if (!message) {
                    res.status(400).json({ error: 'Mesajul este obligatoriu.' });
                    return;
                }
                // Configurăm headerele SSE
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders();
                const timeoutId = setTimeout(() => {
                    res.write(`data: ${JSON.stringify({ error: 'Timeout 90s: Procesarea a durat prea mult.' })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }, 90000);
                res.on('close', () => clearTimeout(timeoutId));
                // Apelăm orchestratorul cu screenContext opțional
                const stream = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat(message, contextString || 'Fără context special generat din formularul anterior.', conversationHistory || [], screenContext, historySummary !== null && historySummary !== void 0 ? historySummary : null);
                try {
                    // Stream progresiv către client
                    for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                        _c = stream_1_1.value;
                        _d = false;
                        const chunk = _c;
                        if (chunk.text) {
                            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                clearTimeout(timeoutId);
                res.write('data: [DONE]\n\n');
                res.end();
            }
            catch (e) {
                console.error('[aiController.chatStream] Eroare:', e);
                if ((e === null || e === void 0 ? void 0 : e.status) === 503 || String(e === null || e === void 0 ? void 0 : e.message).includes('503') || String(e === null || e === void 0 ? void 0 : e.message).includes('indisponibil')) {
                    res.write(`data: ${JSON.stringify({
                        error: 'Asistentul este momentan suprasolicitat. Încearcă din nou în 30 de secunde.'
                    })}\n\n`);
                }
                else {
                    res.write(`data: ${JSON.stringify({ error: 'Eroare internă de server.' })}\n\n`);
                }
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });
    },
    explainMaterial(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
            // Supports both:
            //   - POST with body { projectId, currentMaterialCode, alternativeMaterialCode }  (new, full-context)
            //   - GET with query ?base=x&alt=y  (legacy fallback, minimal context)
            const isPost = req.method === 'POST';
            try {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders();
                const timeoutId = setTimeout(() => {
                    res.write(`data: ${JSON.stringify({ text: '\n[Eroare: Timeout 90s]' })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }, 90000);
                res.on('close', () => clearTimeout(timeoutId));
                let prompt;
                if (isPost) {
                    const { projectId, currentMaterialCode, alternativeMaterialCode } = req.body;
                    if (!projectId || !currentMaterialCode || !alternativeMaterialCode) {
                        res.write(`data: ${JSON.stringify({ text: '[Eroare: lipsă projectId, currentMaterialCode sau alternativeMaterialCode.]' })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                    const { prisma } = yield Promise.resolve().then(() => __importStar(require('../../lib/prisma')));
                    const [project, currentMat, altMat, bomItems] = yield Promise.all([
                        prisma.project.findUnique({
                            where: { id: Number(projectId) },
                            select: {
                                county: true, locality: true, seismicZone: true,
                                frostDepthCm: true, soilType: true, houseStyle: true,
                                totalFloors: true, buildingPurpose: true,
                                chatSummaries: true,
                                planSnapshots: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 1
                                }
                            },
                        }),
                        prisma.material.findUnique({ where: { internalCode: currentMaterialCode } }),
                        prisma.material.findUnique({ where: { internalCode: alternativeMaterialCode } }),
                        prisma.projectBOM.findMany({
                            where: { projectId: Number(projectId) },
                            include: { material: { select: { name: true, category: true, internalCode: true } } },
                        }),
                    ]);
                    if (!project || !currentMat || !altMat) {
                        res.write(`data: ${JSON.stringify({ text: '[Eroare: Proiect sau material negăsit în baza de date.]' })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                    // BOM summary by phase
                    const byPhase = bomItems.reduce((acc, item) => {
                        acc[item.phase] = (acc[item.phase] || 0) + item.totalPrice;
                        return acc;
                    }, {});
                    const bomSummary = Object.entries(byPhase)
                        .map(([phase, total]) => `  - ${phase}: ${total.toLocaleString('ro-RO')} RON`)
                        .join('\n');
                    // Financial impact
                    const currentBOMItem = bomItems.find((b) => b.material.internalCode === currentMaterialCode);
                    let financialImpactBlock = '';
                    if (currentBOMItem) {
                        const costCurrent = currentBOMItem.totalPrice;
                        const costAlt = currentBOMItem.quantity * altMat.pricePerUnit;
                        const delta = costAlt - costCurrent;
                        financialImpactBlock = `
IMPACT FINANCIAR CALCULAT DIN DEVIZ:
- Cantitate necesară proiect: ${currentBOMItem.quantity} ${currentMat.unit}
- Cost actual (${currentMat.name}): ${costCurrent.toLocaleString('ro-RO')} RON
- Cost alternativă (${altMat.name}): ${costAlt.toLocaleString('ro-RO')} RON
- Diferență: ${delta >= 0 ? '+' : ''}${delta.toLocaleString('ro-RO')} RON (${delta >= 0 ? 'mai scump' : 'economie'})`;
                    }
                    prompt = `Ești Zidario, consultant tehnic pentru construcții rezidențiale românești.

CONTEXT AMPLASAMENT:
- Județ: ${(_d = project.county) !== null && _d !== void 0 ? _d : 'nespecificat'}, Localitate: ${(_e = project.locality) !== null && _e !== void 0 ? _e : 'nespecificat'}
- Zonă seismică: ${(_f = project.seismicZone) !== null && _f !== void 0 ? _f : 'necunoscută'} (P100-1/2013)
- Adâncime îngheț: ${(_g = project.frostDepthCm) !== null && _g !== void 0 ? _g : '?'}cm (NP112-2014)
- Tip sol: ${(_h = project.soilType) !== null && _h !== void 0 ? _h : 'necunoscut'}
- Stil casă: ${(_j = project.houseStyle) !== null && _j !== void 0 ? _j : 'nespecificat'}, ${(_k = project.totalFloors) !== null && _k !== void 0 ? _k : 1} etaje
- Destinație: ${(_l = project.buildingPurpose) !== null && _l !== void 0 ? _l : 'rezidențial'}

ISTORIC CONVERSAȚII ȘI PREFERINȚE UTILIZATOR:
${((_m = project.chatSummaries) === null || _m === void 0 ? void 0 : _m.map((s) => `- ${s.phase}: ${s.summary}`).join('\n')) || 'Niciun rezumat disponibil.'}

METRICI PLAN 2D:
${((_o = project.planSnapshots) === null || _o === void 0 ? void 0 : _o[0]) ? `- Perimetru: ${((_q = (_p = project.planSnapshots[0].planJSON) === null || _p === void 0 ? void 0 : _p.metrics) === null || _q === void 0 ? void 0 : _q.perimeterM) || '?'}m\n- Suprafață utilă aprox: ${((_s = (_r = project.planSnapshots[0].planJSON) === null || _r === void 0 ? void 0 : _r.metrics) === null || _s === void 0 ? void 0 : _s.totalFloorAreaSqm) || '?'}mp\n- Număr uși/ferestre extrase din plan: Da` : 'Niciun plan 2D salvat.'}


MATERIAL CURENT ÎN DEVIZ:
- Cod: ${currentMat.internalCode}
- Nume: ${currentMat.name}
- Categorie: ${currentMat.category} / ${(_t = currentMat.subcategory) !== null && _t !== void 0 ? _t : '-'}
- Preț: ${currentMat.pricePerUnit} RON/${currentMat.unit}
- U-value: ${(_u = currentMat.uValue) !== null && _u !== void 0 ? _u : 'nespecificat'} W/m²K
- Descriere: ${(_v = currentMat.description) !== null && _v !== void 0 ? _v : '-'}

ALTERNATIVĂ PROPUSĂ:
- Cod: ${altMat.internalCode}
- Nume: ${altMat.name}
- Categorie: ${altMat.category} / ${(_w = altMat.subcategory) !== null && _w !== void 0 ? _w : '-'}
- Preț: ${altMat.pricePerUnit} RON/${altMat.unit}
- U-value: ${(_x = altMat.uValue) !== null && _x !== void 0 ? _x : 'nespecificat'} W/m²K
- Descriere: ${(_y = altMat.description) !== null && _y !== void 0 ? _y : '-'}

DEVIZ COMPLET PE FAZE (materiale deja selectate):
${bomSummary || '  (deviz gol)'}
${financialImpactBlock}

SARCINI (răspunde structurat, maxim 200 cuvinte, în română):
1. ✅/❌ COMPATIBILITATE: Este alternativa compatibilă cu zona seismică ${(_z = project.seismicZone) !== null && _z !== void 0 ? _z : '?'} și solul ${(_0 = project.soilType) !== null && _0 !== void 0 ? _0 : '?'}?
2. 🔧 COMPATIBILITATE MATERIALE: Se potrivește cu celelalte materiale alese în deviz?
3. 🌡️ IMPACT ENERGETIC: Cum afectează clasa energetică? (compară U-values dacă disponibile)
4. 💰 VERDICT FINANCIAR: Merită diferența de preț pentru acest proiect specific?
5. 📋 NORMATIVE: Citează articolul exact dacă există restricții (CR6-2013, NE012-1:2022, Mc-001-2022, P100-1/2013).

IMPORTANT: Dacă alternativa este incompatibilă cu zona seismică sau solul, spune NU clar și motivează.`;
                }
                else {
                    // Legacy GET path — minimal context
                    const base = req.query.base;
                    const alt = req.query.alt;
                    if (!base || !alt) {
                        res.write(`data: ${JSON.stringify({ text: '[Eroare: parametri lipsă]' })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                    prompt = `Ești Zidario AI, expert în normative de construcții românești.
Explică pe scurt de ce un client ar trebui să aleagă "${alt}" în loc de "${base}".
Include doar aspecte tehnice și normative relevante (CR6-2013, NE012, Mc-001-2022).
Max 120 cuvinte. Fii direct și profesionist.`;
                }
                // RAG context
                const question = prompt.substring(0, 300);
                const structuralChunks = yield (0, ragService_1.searchHybrid)(question, 'structural', 3, undefined, 'residential');
                const energeticChunks = yield (0, ragService_1.searchHybrid)(question, 'energetic', 2, undefined, 'residential');
                const combinedChunks = [...structuralChunks, ...energeticChunks];
                if (combinedChunks.length === 0) {
                    res.write(`data: ${JSON.stringify({ meta: { noSources: true } })}\n\n`);
                }
                else {
                    const ragContext = combinedChunks.map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`).join('\n\n');
                    prompt = `SURSE NORMATIVE INDEXATE (RAG):\n${ragContext}\n\n---\n\n${prompt}`;
                }
                let stream = null;
                let lastError = null;
                for (const modelName of aiClient_1.FALLBACK_MODELS_CHAT) {
                    try {
                        stream = yield getAi().models.generateContentStream({
                            model: modelName,
                            contents: prompt,
                            config: { maxOutputTokens: 1500, temperature: 0.2 }
                        });
                        break;
                    }
                    catch (e) {
                        lastError = e;
                        console.warn(`[explainMaterial] Eroare cu ${modelName}: ${(_1 = e === null || e === void 0 ? void 0 : e.message) === null || _1 === void 0 ? void 0 : _1.substring(0, 80)}`);
                    }
                }
                if (!stream)
                    throw new Error('Serviciul este momentan indisponibil.');
                try {
                    for (var _2 = true, stream_2 = __asyncValues(stream), stream_2_1; stream_2_1 = yield stream_2.next(), _a = stream_2_1.done, !_a; _2 = true) {
                        _c = stream_2_1.value;
                        _2 = false;
                        const chunk = _c;
                        if (chunk.text)
                            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (!_2 && !_a && (_b = stream_2.return)) yield _b.call(stream_2);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                clearTimeout(timeoutId);
                res.write('data: [DONE]\n\n');
                res.end();
            }
            catch (e) {
                console.error('[aiController.explainMaterial] Eroare:', e);
                res.write(`data: ${JSON.stringify({ text: '\n[Eroare la generarea explicației.]' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });
    },
    explainMaterialById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_3, _b, _c;
            try {
                const materialId = parseInt(req.params.materialId, 10);
                if (isNaN(materialId)) {
                    res.status(400).json({ error: 'ID material invalid' });
                    return;
                }
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders();
                const timeoutId = setTimeout(() => {
                    res.write(`data: ${JSON.stringify({ text: '\n[Eroare: Timeout 90s]' })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }, 90000);
                res.on('close', () => clearTimeout(timeoutId));
                const { prisma } = yield Promise.resolve().then(() => __importStar(require('../../lib/prisma')));
                const material = yield prisma.material.findUnique({
                    where: { id: materialId },
                    include: { chunks: true }
                });
                if (!material) {
                    res.write(`data: ${JSON.stringify({ text: 'Materialul nu a fost găsit în baza de date.' })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                    return;
                }
                let specs = material.description || '';
                if (material.chunks && material.chunks.length > 0) {
                    specs += '\n\n' + material.chunks.map((c) => c.content).join('\n');
                }
                const prompt = `Ești Zidario AI, un expert tehnic în materiale de construcții.
Oferă o explicație scurtă și pur tehnică (max 80 cuvinte) pentru beneficiile utilizării materialului "${material.name}" într-un proiect de construcție rezidențială.
Folosește următoarele date tehnice disponibile:
${specs}

Nu folosi un ton de marketing, ci unul strict ingineresc (izolație termică, rezistență, compresiune, fonoizolație, utilitate). Nu saluta.`;
                let stream = null;
                let lastError = null;
                for (const modelName of aiClient_1.FALLBACK_MODELS_CHAT) {
                    try {
                        stream = yield getAi().models.generateContentStream({
                            model: modelName,
                            contents: prompt
                        });
                        break;
                    }
                    catch (e) {
                        lastError = e;
                        const is503 = (e === null || e === void 0 ? void 0 : e.status) === 503 || String(e === null || e === void 0 ? void 0 : e.message).includes('503') || String(e === null || e === void 0 ? void 0 : e.message).toLowerCase().includes('high demand');
                        if (is503)
                            continue;
                        break;
                    }
                }
                if (!stream) {
                    throw new Error('Modelele sunt indisponibile.');
                }
                try {
                    for (var _d = true, stream_3 = __asyncValues(stream), stream_3_1; stream_3_1 = yield stream_3.next(), _a = stream_3_1.done, !_a; _d = true) {
                        _c = stream_3_1.value;
                        _d = false;
                        const chunk = _c;
                        if (chunk.text) {
                            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = stream_3.return)) yield _b.call(stream_3);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                clearTimeout(timeoutId);
                res.write('data: [DONE]\n\n');
                res.end();
            }
            catch (e) {
                console.error('[aiController.explainMaterialById] Eroare:', e);
                res.write(`data: ${JSON.stringify({ text: '\n[Eroare la generarea explicației.]' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });
    },
    /**
     * POST /api/ai/summarize
     * Rezumă o conversație lungă în maxim 200 de cuvinte.
     * Apel simplu Gemini (non-streaming) — rezumatul e scurt și rapid.
     * Folosit de useZidarioChat la MAX_HISTORY mesaje.
     */
    summarizeConversation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { systemPrompt, text } = req.body;
                if (!text) {
                    res.status(400).json({ error: 'Textul conversației este obligatoriu.' });
                    return;
                }
                const fullPrompt = systemPrompt
                    ? `${systemPrompt}\n\n${text}`
                    : text;
                let result = null;
                let lastError = null;
                for (const modelName of aiClient_1.FALLBACK_MODELS_CHAT) {
                    try {
                        result = yield getAi().models.generateContent({
                            model: modelName,
                            contents: fullPrompt,
                            config: {
                                maxOutputTokens: 400,
                                temperature: 0.3 // mai puțin creativ, mai determinist la rezumat
                            }
                        });
                        break;
                    }
                    catch (e) {
                        lastError = e;
                        const is503 = (e === null || e === void 0 ? void 0 : e.status) === 503 || String(e === null || e === void 0 ? void 0 : e.message).includes('503') || String(e === null || e === void 0 ? void 0 : e.message).toLowerCase().includes('high demand');
                        if (is503) {
                            console.warn(`[summarizeConversation] 503 cu ${modelName}, încercăm următorul...`);
                            continue;
                        }
                        console.warn(`[summarizeConversation] Eroare cu ${modelName}, încercăm următorul... Motiv: ${(_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.substring(0, 100)}...`);
                        continue;
                    }
                }
                if (!result) {
                    console.error(`[summarizeConversation] Toate modelele au eșuat. Ultima eroare:`, lastError === null || lastError === void 0 ? void 0 : lastError.message);
                    throw new Error('Serviciul este momentan indisponibil.');
                }
                const summary = (_b = result.text) !== null && _b !== void 0 ? _b : '';
                res.json({ summary });
            }
            catch (e) {
                console.error('[aiController.summarizeConversation] Eroare:', e);
                res.status(500).json({ error: 'Serviciul de rezumare nu este disponibil.' });
            }
        });
    },
    /**
     * GET /api/ai/summary/:projectId?phase=...&screen=...
     * Returnează rezumatul existent pentru un ecran specificat.
     * Folosit de useZidarioChat la mount pentru a restaura contextul.
     */
    getSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Ownership verificat de tenantGuard — req.project este disponibil
                const projectId = parseInt(req.params.projectId);
                const phase = req.query.phase;
                const screen = req.query.screen;
                if (!phase) {
                    res.status(400).json({ error: 'phase este obligatoriu.' });
                    return;
                }
                const summary = yield chatSummaryRepository_1.chatSummaryRepository.getOne(projectId, phase, screen !== null && screen !== void 0 ? screen : null);
                res.json({ summary: (_a = summary === null || summary === void 0 ? void 0 : summary.summary) !== null && _a !== void 0 ? _a : null });
            }
            catch (e) {
                console.error('[aiController.getSummary] Eroare:', e);
                res.status(500).json({ error: 'Eroare la citirea rezumatului.' });
            }
        });
    },
    /**
     * POST /api/ai/summary
     * Salvează (upsert) rezumatul pentru un ecran specificat.
     * Apelat automat de useZidarioChat la fiecare 10 mesaje.
     */
    saveSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ownership verificat de tenantGuard — req.project este disponibil
                const { projectId, phase, screen, summary } = req.body;
                if (!phase || !summary) {
                    res.status(400).json({ error: 'phase și summary sunt obligatorii.' });
                    return;
                }
                const result = yield chatSummaryRepository_1.chatSummaryRepository.upsert(projectId, phase, screen !== null && screen !== void 0 ? screen : null, summary);
                res.json({ success: true, id: result.id });
            }
            catch (e) {
                console.error('[aiController.saveSummary] Eroare:', e);
                res.status(500).json({ error: 'Eroare la salvarea rezumatului.' });
            }
        });
    },
    /**
     * POST /api/ai/suggest-rooms
     * Generează programul funcțional recomandat de AI pentru un proiect.
     * Body: { projectId, familySize, budgetCategory }
     * Ownership verificat prin tenantGuard (extrage projectId din body).
     */
    suggestRooms(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            try {
                const { projectId, familySize, budgetCategory, houseAreaSqm } = req.body;
                if (!projectId || !familySize || !budgetCategory || !houseAreaSqm) {
                    res.status(400).json({ error: 'projectId, familySize, budgetCategory și houseAreaSqm sunt obligatorii.' });
                    return;
                }
                const validBudgets = ['economic', 'mediu'];
                if (!validBudgets.includes(budgetCategory)) {
                    res.status(400).json({ error: `budgetCategory invalid. Valori acceptate: ${validBudgets.join(', ')}` });
                    return;
                }
                const familySizeNum = parseInt(familySize, 10);
                if (isNaN(familySizeNum) || familySizeNum < 1 || familySizeNum > 20) {
                    res.status(400).json({ error: 'familySize trebuie să fie un număr între 1 și 20.' });
                    return;
                }
                // Ownership deja verificat de tenantGuard — citim proiectul din DB
                const project = yield projectRepository_1.projectRepository.findById(parseInt(projectId, 10));
                if (!project) {
                    res.status(404).json({ error: 'Proiect negăsit.' });
                    return;
                }
                const suggestion = yield (0, agentOrchestrator_1.suggestRoomProgram)({
                    houseAreaSqm: Number(houseAreaSqm),
                    plotAreaSqm: (_a = project.plotAreaSqm) !== null && _a !== void 0 ? _a : 300,
                    houseStyle: (_b = project.houseStyle) !== null && _b !== void 0 ? _b : 'Modern',
                    totalFloors: (_c = project.totalFloors) !== null && _c !== void 0 ? _c : 1,
                    hasBasement: project.hasBasement,
                    streetOrientation: (_d = project.streetOrientation) !== null && _d !== void 0 ? _d : 'S',
                    familySize: familySizeNum,
                    budgetCategory: budgetCategory,
                    buildingPurpose: (_e = project.buildingPurpose) !== null && _e !== void 0 ? _e : 'residential',
                });
                res.json(suggestion);
            }
            catch (e) {
                console.error('[aiController.suggestRooms] Eroare:', e);
                res.status(500).json({ error: (_f = e.message) !== null && _f !== void 0 ? _f : 'Eroare internă.' });
            }
        });
    },
};
// ─────────────────────────────────────────────────────────────────
// EXPORT NAMED — validateMaterialOverride
//
// POST /api/ai/validate-override
// Verifică dacă înlocuirea unui material este conformă normativ.
// Returnează SSE cu verdict concis (Conform / Atenție / Neconform).
// ─────────────────────────────────────────────────────────────────
function validateMaterialOverride(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_4, _b, _c;
        var _d, _e;
        try {
            const { originalMaterialName, newMaterialName, formulaKey, projectContext, // string deja formatat (seismicZone, soilType etc.)
             } = req.body;
            if (!originalMaterialName || !newMaterialName || !formulaKey) {
                res.status(400).json({ error: 'originalMaterialName, newMaterialName, formulaKey sunt obligatorii.' });
                return;
            }
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            const timeoutId = setTimeout(() => {
                res.write(`data: ${JSON.stringify({ text: '\n[Eroare: Timeout 90s]' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }, 90000);
            res.on('close', () => clearTimeout(timeoutId));
            // Construim un prompt concis + normativ
            const question = `Conformitate normativă pentru înlocuire material: "${originalMaterialName}" -> "${newMaterialName}" pentru etapa ${formulaKey}.`;
            const structuralChunks = yield (0, ragService_1.searchHybrid)(question, 'structural', 3, undefined, 'residential');
            const energeticChunks = yield (0, ragService_1.searchHybrid)(question, 'energetic', 2, undefined, 'residential');
            const combinedChunks = [...structuralChunks, ...energeticChunks];
            if (combinedChunks.length === 0) {
                res.write(`data: ${JSON.stringify({ meta: { noSources: true } })}\n\n`);
                res.write(`data: ${JSON.stringify({ text: '⚠️ Atenție: Nu există surse normative indexate pentru această înlocuire. Verificați manual normativele aplicabile.' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }
            const ragContext = combinedChunks
                .map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`)
                .join('\n\n');
            const contextBlock = projectContext
                ? `\nContextul proiectului:\n${projectContext}\n`
                : '';
            const prompt = `Ești Zidario AI, expert în inginerie civilă și normative de construcții românești.
${contextBlock}
Foloseste EXCLUSIV sursele de mai jos. Dacă nu e suficientă informația, răspunde cu "⚠️ Atenție".

SURSE NORMATIVE (RAG):
${ragContext}

Utilizatorul vrea să înlocuiască materialul original cu unul alternativ în cadrul etapei "${formulaKey}":
- Material original: "${originalMaterialName}"
- Material alternativ propus: "${newMaterialName}"

Verifică rapid dacă această înlocuire este conformă normativ (CR6-2013, NE012-1:2022, P100-1/2013, NP112-2014).
Răspunde CONCIS în maxim 80 de cuvinte. Structura răspunsului:
1. Primul cuvânt TREBUIE să fie exact: "✅ Conform" SAU "⚠️ Atenție" SAU "❌ Neconform"
2. Motivul tehnic scurt (1-2 propoziții cu referința normativă exactă)
3. Dacă e Neconform sau Atenție — indică ce trebuie să verifice beneficiarul

Nu inventa normative. Dacă nu știi cu certitudine, folosește "⚠️ Atenție".`;
            let stream = null;
            let lastError = null;
            for (const modelName of aiClient_1.FALLBACK_MODELS_CHAT) {
                try {
                    stream = yield getAi().models.generateContentStream({
                        model: modelName,
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        config: { temperature: 0.2, maxOutputTokens: 200 },
                    });
                    break;
                }
                catch (e) {
                    lastError = e;
                    const is503 = (e === null || e === void 0 ? void 0 : e.status) === 503 || String(e === null || e === void 0 ? void 0 : e.message).includes('503') || String(e === null || e === void 0 ? void 0 : e.message).toLowerCase().includes('high demand');
                    if (is503) {
                        console.warn(`[validateMaterialOverride] 503 cu ${modelName}, încercăm următorul...`);
                        continue;
                    }
                    console.warn(`[validateMaterialOverride] Eroare cu ${modelName}, încercăm următorul... Motiv: ${(_d = e === null || e === void 0 ? void 0 : e.message) === null || _d === void 0 ? void 0 : _d.substring(0, 100)}...`);
                    continue;
                }
            }
            if (!stream) {
                console.error(`[validateMaterialOverride] Toate modelele au eșuat. Ultima eroare:`, lastError === null || lastError === void 0 ? void 0 : lastError.message);
                throw new Error('Serviciul este momentan indisponibil.');
            }
            try {
                for (var _f = true, stream_4 = __asyncValues(stream), stream_4_1; stream_4_1 = yield stream_4.next(), _a = stream_4_1.done, !_a; _f = true) {
                    _c = stream_4_1.value;
                    _f = false;
                    const chunk = _c;
                    const text = (_e = chunk.text) !== null && _e !== void 0 ? _e : '';
                    if (text) {
                        res.write(`data: ${JSON.stringify({ text })}\n\n`);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_4.return)) yield _b.call(stream_4);
                }
                finally { if (e_4) throw e_4.error; }
            }
            clearTimeout(timeoutId);
            res.write('data: [DONE]\n\n');
            res.end();
        }
        catch (e) {
            console.error('[validateMaterialOverride] Eroare:', e);
            res.write(`data: ${JSON.stringify({ text: '⚠️ Eroare la verificarea conformității. Verificați manual normativele aplicabile.' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
    });
}
