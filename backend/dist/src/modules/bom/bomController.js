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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bomAdvisorChat = exports.exportPdf = exports.confirmBOMPhase = exports.getBOMPhaseState = exports.getBOMIntro = exports.updateMaterialOverride = exports.generateBOM = void 0;
const bomService_1 = require("./bomService");
const prisma_1 = require("../../lib/prisma");
const agentOrchestrator_1 = require("../ai/services/agentOrchestrator");
const bomPhaseProgressRepository_1 = require("./bomPhaseProgressRepository");
const bomIntroCacheRepository_1 = require("./bomIntroCacheRepository");
const genai_1 = require("@google/genai");
const pdfService_1 = require("./pdfService");
const BOM_PHASE_ORDER = [
    'fundatie',
    'structura',
    'planseu',
    'termoizolatie',
    'acoperis',
    'tamplarie',
    'instalatii',
    'finisaje',
    'exterior'
];
const BOM_PHASE_KEYWORDS = {
    fundatie: /fundati|fundare|radier|talpa|elevati|cota zero|soclu|izolare la sol/i,
    structura: /structur|stalp|stâlp|grinda|grindă|armatura|armătur|beton armat|zidarie|zidărie|caramida|cărămid|bca|blocuri/i,
    planseu: /planseu|planșeu|placa|placă|coroana|centura/i,
    termoizolatie: /termoizol|izolat|izolați|polistiren|vata|vată|etics|hidroizol|bariera vapori/i,
    acoperis: /acoperis|acoperiș|sarpanta|șarpant|invelitoare|învelitoare|tabla|țiglă/i,
    tamplarie: /tamplarie|tâmplărie|fereastr|geam|usa|ușă|glaf/i,
    instalatii: /instalati|instalați|electri|sanitar|termic|ventil|clima|teava|țeavă|cablu|priza|priză/i,
    finisaje: /finisaj|tencuial|vopsea|pardoseala|gresie|faianta|faianță|parchet|glet|lavabil/i,
    exterior: /amenajar|exterior|trotuar|pavaj|curte|gard|bordur/i,
};
const BOM_PHASE_LABELS = {
    fundatie: 'Fundație',
    structura: 'Structură',
    planseu: 'Planșeu & Coroană',
    termoizolatie: 'Termoizolație & Hidroizolație',
    acoperis: 'Acoperiș',
    tamplarie: 'Tâmplărie',
    instalatii: 'Instalații',
    finisaje: 'Finisaje',
    exterior: 'Amenajări Exterioare',
};
const CONFIRMATION_PATTERNS = /\b(da|ok|bine|perfect|clar|inteleg|înțeleg|am inteles|am înțeles|sigur|confirm)\b/i;
const INTRO_CACHE_MAX_AGE_DAYS = 30;
const LEGACY_PHASE_ALIASES = {
    zidarie: 'structura',
};
// Lazy init — același pattern ca în aiController
let aiInstance = null;
const getAi = () => {
    if (!aiInstance)
        aiInstance = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return aiInstance;
};
function detectPhaseFromMessage(message) {
    const msg = message.toLowerCase();
    for (const phase of BOM_PHASE_ORDER) {
        if (BOM_PHASE_KEYWORDS[phase].test(msg))
            return phase;
    }
    return null;
}
function phaseOrder(phase) {
    return BOM_PHASE_ORDER.indexOf(phase);
}
function isConfirmationMessage(message) {
    return CONFIRMATION_PATTERNS.test(message.trim());
}
function normalizePhaseKey(value) {
    var _a;
    if (!value)
        return null;
    const key = value.toLowerCase().trim();
    if (BOM_PHASE_ORDER.includes(key))
        return key;
    return (_a = LEGACY_PHASE_ALIASES[key]) !== null && _a !== void 0 ? _a : null;
}
function loadPhaseState(projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const record = yield bomPhaseProgressRepository_1.bomPhaseProgressRepository.getByProject(projectId);
        if (!record)
            return { activePhase: 'fundatie', completedPhases: [] };
        const activePhase = (_a = normalizePhaseKey(record.activePhase)) !== null && _a !== void 0 ? _a : 'fundatie';
        const completedPhases = Array.isArray(record.completedPhases)
            ? record.completedPhases
                .map((p) => normalizePhaseKey(String(p)))
                .filter((p) => Boolean(p))
            : [];
        return { activePhase, completedPhases };
    });
}
function savePhaseState(projectId, state) {
    return __awaiter(this, void 0, void 0, function* () {
        yield bomPhaseProgressRepository_1.bomPhaseProgressRepository.upsert(projectId, state);
    });
}
function classifyPhaseWithAI(message) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const prompt = `Clasifică mesajul în una dintre fazele: fundatie, structura, planseu, termoizolatie, acoperis, tamplarie, instalatii, finisaje, exterior.
Răspunde strict JSON: {"phase":"fundatie"} sau {"phase":"none"}.
Mesaj: "${message}"`;
        try {
            const result = yield getAi().models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { maxOutputTokens: 40, temperature: 0 }
            });
            const text = (_a = result.text) !== null && _a !== void 0 ? _a : '';
            const match = text.match(/\{\s*"phase"\s*:\s*"(.*?)"\s*\}/i);
            const phase = (_b = match === null || match === void 0 ? void 0 : match[1]) === null || _b === void 0 ? void 0 : _b.toLowerCase();
            if (!phase || phase === 'none')
                return null;
            return BOM_PHASE_ORDER.includes(phase) ? phase : null;
        }
        catch (_c) {
            return null;
        }
    });
}
function formatIntroFallback(project) {
    const parts = [
        project.county ? `proiectul tau este in judetul ${project.county}` : null,
        project.locality ? `localitatea ${project.locality}` : null,
        project.seismicZone ? `zona seismica ${project.seismicZone}` : null,
        project.frostDepthCm ? `adancime de inghet ${project.frostDepthCm} cm` : null,
        project.soilType ? `sol ${project.soilType}` : null,
    ].filter(Boolean);
    const context = parts.length > 0 ? `Am vazut ca ${parts.join(', ')}.` : 'Am vazut datele de baza ale proiectului tau.';
    return `${context} Vom parcurge impreuna cele 9 etape ale constructiei, incepand cu fundatia. Vrei sa incepem cu fundatia?`;
}
function withTimeout(promise, ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms);
            promise
                .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
                .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    });
}
const generateBOM = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const bomItems = yield bomService_1.bomService.calculateBOM(projectId);
        res.json(bomItems);
    }
    catch (error) {
        console.error('[BOMController] Eroare la generarea BOM-ului:', error);
        res.status(500).json({ error: `Eroare Backend BOM: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`, stack: error === null || error === void 0 ? void 0 : error.stack });
    }
});
exports.generateBOM = generateBOM;
const updateMaterialOverride = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const { formulaKey, newMaterialCode } = req.body;
        if (!formulaKey || !newMaterialCode) {
            res.status(400).json({ error: 'Necesită formulaKey și newMaterialCode' });
            return;
        }
        const bomItems = yield bomService_1.bomService.updateMaterialOverride(projectId, formulaKey, newMaterialCode);
        res.json(bomItems);
    }
    catch (error) {
        console.error('[BOMController] Eroare la suprascrierea materialului:', error);
        res.status(500).json({ error: error.message || 'Eroare la suprascrierea materialului' });
    }
});
exports.updateMaterialOverride = updateMaterialOverride;
/**
 * GET /api/bom/:projectId/intro
 * Mesaj introductiv non-streaming pentru chat-ul BOM.
 */
const getBOMIntro = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const project = yield prisma_1.prisma.project.findUnique({
            where: { id: projectId },
            select: {
                county: true,
                locality: true,
                seismicZone: true,
                frostDepthCm: true,
                soilType: true,
                buildingPurpose: true,
            }
        });
        if (!project) {
            res.status(404).json({ error: 'Proiect negăsit' });
            return;
        }
        const cached = yield bomIntroCacheRepository_1.bomIntroCacheRepository.getByProject(projectId);
        if (cached) {
            const ageDays = Math.floor((Date.now() - new Date(cached.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
            if (ageDays <= INTRO_CACHE_MAX_AGE_DAYS) {
                res.json({ text: cached.introText });
                return;
            }
        }
        const contextLines = [
            project.county ? `Județ: ${project.county}` : null,
            project.locality ? `Localitate: ${project.locality}` : null,
            project.seismicZone ? `Zonă seismică: ${project.seismicZone}` : null,
            project.frostDepthCm ? `Adâncime îngheț: ${project.frostDepthCm} cm` : null,
            project.soilType ? `Tip sol: ${project.soilType}` : null,
            project.buildingPurpose ? `Destinație: ${project.buildingPurpose}` : null,
        ].filter(Boolean).join('\n');
        const prompt = `Ești Zidario, mentorul tehnic al utilizatorului de-a lungul procesului de construcție.
Stilul tău: proactiv, educativ, empatic. Explici DE CE înainte de CE.
Scrie un mesaj introductiv de 4-6 propoziții pentru chat-ul BOM.
Include 1-2 observații despre contextul proiectului și încheie cu o întrebare care invită la dialog.
Nu folosi liste.

Date proiect:
${contextLines}

Etape construcție: Fundație, Structură, Planșeu & Coroană, Termoizolație & Hidroizolație, Acoperiș, Tâmplărie, Instalații, Finisaje, Amenajări Exterioare.`;
        let introText = '';
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const result = yield withTimeout(getAi().models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        maxOutputTokens: 220,
                        temperature: 0.5
                    }
                }), 4500);
                introText = (_a = result.text) !== null && _a !== void 0 ? _a : '';
                if (introText.trim().length > 0)
                    break;
            }
            catch (_b) {
                // retry once
            }
        }
        if (!introText.trim()) {
            introText = formatIntroFallback(project);
        }
        yield bomIntroCacheRepository_1.bomIntroCacheRepository.upsert(projectId, introText);
        res.json({ text: introText });
    }
    catch (error) {
        console.error('[BOMController.getBOMIntro] Eroare:', error);
        res.status(500).json({ error: 'Eroare la generarea mesajului introductiv' });
    }
});
exports.getBOMIntro = getBOMIntro;
/**
 * GET /api/bom/:projectId/phase-state
 * Starea curentă a tracker-ului BOM.
 */
const getBOMPhaseState = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const state = yield loadPhaseState(projectId);
        res.json(state);
    }
    catch (error) {
        console.error('[BOMController.getBOMPhaseState] Eroare:', error);
        res.status(500).json({ error: 'Eroare la citirea starii etapelor' });
    }
});
exports.getBOMPhaseState = getBOMPhaseState;
/**
 * POST /api/bom/:projectId/phase-state/confirm
 * Confirmă etapa curentă.
 */
const confirmBOMPhase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const state = yield loadPhaseState(projectId);
        // Asigură-te că adaugi faza în completedPhases dacă nu e deja
        if (!state.completedPhases.includes(state.activePhase)) {
            state.completedPhases = [...state.completedPhases, state.activePhase];
        }
        // Indiferent dacă a fost abia acum completată sau mai devreme via chat,
        // avansează automat activePhase la următoarea etapă nefinalizată.
        let nextPhase = state.activePhase;
        const currentIndex = BOM_PHASE_ORDER.indexOf(state.activePhase);
        for (let i = currentIndex + 1; i < BOM_PHASE_ORDER.length; i++) {
            if (!state.completedPhases.includes(BOM_PHASE_ORDER[i])) {
                nextPhase = BOM_PHASE_ORDER[i];
                break;
            }
        }
        // Salvăm doar dacă s-a schimbat ceva (fază completată sau faza activă s-a mutat)
        state.activePhase = nextPhase;
        yield savePhaseState(projectId, state);
        res.json(state);
    }
    catch (error) {
        console.error('[bomController.confirmBOMPhase] Eroare:', error);
        res.status(500).json({ error: 'Eroare la confirmarea etapei' });
    }
});
exports.confirmBOMPhase = confirmBOMPhase;
/**
 * GET /api/bom/:projectId/export-pdf
 * Generează PDF-ul pentru proiectul specificat.
 */
const exportPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const pdfBuffer = yield pdfService_1.pdfService.generateBOMPdf(projectId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Deviz_Zidario_Proiect_${projectId}.pdf`);
        // Puppeteer Buffer poate fi trimis direct cu res.send
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('[bomController.exportPdf] Eroare:', error);
        res.status(500).json({ error: 'Eroare la generarea PDF-ului' });
    }
});
exports.exportPdf = exportPdf;
/**
 * POST /api/bom/:projectId/chat
 * Chat RAG conversațional pentru deviz — SSE Streaming.
 *
 * Deleghează la agentOrchestrator.getAiStreamForChat() cu:
 *   - screenContext: 'bom'  → SCREEN_AGENTS['bom'] = ['structural', 'materiale', 'deviz', 'energetic']
 *   - projectData din DB    → buildRAGContext() îl injectează ca date deterministe
 *
 * Zero logică duplicată — refolosește orchestratorul existent.
 */
const bomAdvisorChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const { message, conversationHistory, historySummary } = req.body;
        if (!message) {
            res.status(400).json({ error: 'message este obligatoriu' });
            return;
        }
        // Citim datele proiectului din DB — context determinist
        const project = yield prisma_1.prisma.project.findUnique({
            where: { id: projectId },
            select: {
                county: true, locality: true,
                seismicZone: true, frostDepthCm: true,
                soilType: true, buildingPurpose: true,
                totalFloors: true, totalFloorAreaSqm: true,
            }
        });
        if (!project) {
            res.status(404).json({ error: 'Proiect negăsit' });
            return;
        }
        // contextString — rezumat textual injectat direct în prompt de orchestrator
        const contextLines = [
            project.county ? `Județ: ${project.county}` : null,
            project.locality ? `Localitate: ${project.locality}` : null,
            project.seismicZone ? `Zonă seismică: ${project.seismicZone}` : null,
            project.frostDepthCm ? `Adâncime îngheț: ${project.frostDepthCm} cm` : null,
            project.soilType ? `Tip sol: ${project.soilType}` : null,
            project.totalFloors ? `Niveluri: ${project.totalFloors}` : null,
            project.totalFloorAreaSqm ? `Suprafață planșee: ${project.totalFloorAreaSqm} mp` : null,
        ].filter(Boolean);
        const bomItems = yield prisma_1.prisma.projectBOM.findMany({
            where: { projectId },
            include: { material: true }
        });
        const bomText = bomItems.map(item => {
            var _a, _b, _c, _d;
            const noteParts = ((_a = item.note) === null || _a === void 0 ? void 0 : _a.split('||EXPLAIN||')) || [];
            const explanation = noteParts.length > 1 ? noteParts[1].trim() : '';
            const materialDesc = ((_b = item.material) === null || _b === void 0 ? void 0 : _b.description) ? ` | Info material: ${item.material.description}` : '';
            return `- Faza: ${item.phase} | Material: ${(_c = item.material) === null || _c === void 0 ? void 0 : _c.name} | Cantitate: ${item.quantity} ${(_d = item.material) === null || _d === void 0 ? void 0 : _d.unit} ${explanation ? '| Motivare: ' + explanation : ''}${materialDesc}`;
        }).join('\n');
        const contextString = contextLines.length > 0
            ? `Date proiect:\n${contextLines.join('\n')}\n\nMATERIALE CALCULATE (Deviz):\n${bomText}`
            : `Date proiect indisponibile.\n\nMATERIALE CALCULATE (Deviz):\n${bomText}`;
        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        // Phase tracking + gating
        let phaseState = yield loadPhaseState(projectId);
        let detectedPhase = detectPhaseFromMessage(message);
        const wantsConfirm = isConfirmationMessage(message);
        if (!detectedPhase && message.trim().length >= 12) {
            detectedPhase = yield classifyPhaseWithAI(message);
        }
        if (wantsConfirm && !phaseState.completedPhases.includes(phaseState.activePhase)) {
            phaseState = {
                activePhase: phaseState.activePhase,
                completedPhases: [...phaseState.completedPhases, phaseState.activePhase]
            };
            yield savePhaseState(projectId, phaseState);
        }
        if (detectedPhase) {
            const currentOrder = phaseOrder(phaseState.activePhase);
            const desiredOrder = phaseOrder(detectedPhase);
            const currentCompleted = phaseState.completedPhases.includes(phaseState.activePhase);
            if (desiredOrder > currentOrder && !currentCompleted) {
                // Blocăm avansarea până confirmă etapa curentă
                res.write('event: phase\n');
                res.write(`data: ${JSON.stringify({
                    phase: phaseState.activePhase,
                    completedPhases: phaseState.completedPhases
                })}\n\n`);
                res.write('event: message\n');
                res.write(`data: ${JSON.stringify({
                    text: `Înainte să trecem mai departe, vreau să confirmăm etapa curentă (${BOM_PHASE_LABELS[phaseState.activePhase]}). Apasă „Confirmă etapa” sau scrie "confirm" dacă ai înțeles.`
                })}\n\n`);
                res.write('event: done\n');
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }
            if (desiredOrder !== currentOrder && (currentCompleted || desiredOrder <= currentOrder)) {
                phaseState = Object.assign(Object.assign({}, phaseState), { activePhase: detectedPhase });
                yield savePhaseState(projectId, phaseState);
            }
        }
        // Emit phase state la începutul răspunsului
        res.write('event: phase\n');
        res.write(`data: ${JSON.stringify({
            phase: phaseState.activePhase,
            completedPhases: phaseState.completedPhases
        })}\n\n`);
        // Delegăm la orchestratorul existent — fără logică duplicată
        const stream = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat(message, contextString, conversationHistory || [], 'bom', // → SCREEN_AGENTS['bom'] = ['structural', 'materiale', 'deviz', 'energetic']
        historySummary !== null && historySummary !== void 0 ? historySummary : null, {
            county: project.county,
            locality: project.locality,
            seismicZone: project.seismicZone,
            frostDepthCm: project.frostDepthCm,
            soilType: project.soilType,
            buildingPurpose: project.buildingPurpose,
        });
        try {
            for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                _c = stream_1_1.value;
                _d = false;
                const chunk = _c;
                if (chunk.text) {
                    res.write('event: message\n');
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
        res.write('event: done\n');
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (error) {
        console.error('[BOMController.bomAdvisorChat] Eroare:', error);
        res.write(`data: ${JSON.stringify({ text: '\n[Eroare la conectarea cu Zidario AI.]' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
});
exports.bomAdvisorChat = bomAdvisorChat;
