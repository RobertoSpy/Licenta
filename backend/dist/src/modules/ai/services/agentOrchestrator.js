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
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentOrchestrator = void 0;
exports.suggestRoomProgram = suggestRoomProgram;
const normative_registry_1 = require("../../../data/normative-registry");
const ragService_1 = require("./ragService");
const aiClient_1 = require("./aiClient");
const agentRouter_1 = require("./agentRouter");
const promptBuilder_1 = require("./promptBuilder");
const chatPromptBuilder_1 = require("./chatPromptBuilder");
const roomProgramPrompt_1 = require("./roomProgramPrompt");
exports.agentOrchestrator = {
    getAiStreamForChat(userQuestion_1, contextString_1) {
        return __awaiter(this, arguments, void 0, function* (userQuestion, contextString, conversationHistory = [], screenContext, historySummary, projectData) {
            var _a, _b, _c, _d;
            if ((0, agentRouter_1.isOffTopic)(userQuestion)) {
                console.log(`[agentOrchestrator] Off-topic clar: "${userQuestion.slice(0, 60)}"`);
                return (0, chatPromptBuilder_1.buildOffTopicRefusalStream)();
            }
            const screen = screenContext !== null && screenContext !== void 0 ? screenContext : 'screen1';
            const activeAgents = yield (0, agentRouter_1.detectRequiredAgents)(userQuestion, screen);
            console.log(`[agentOrchestrator] Agenți detectați: [${activeAgents.join(', ')}]`);
            // Injectăm contextul de piață în mod automat când ecranul este 'market'
            let enrichedContextString = contextString;
            if (screen === 'market') {
                try {
                    const { marketService } = yield Promise.resolve().then(() => __importStar(require('../../market/marketService')));
                    const summary = yield marketService.getSummary();
                    enrichedContextString = summary.contextString + '\n\n' + contextString;
                }
                catch (e) {
                    console.warn('[agentOrchestrator] Nu am putut îmbogăți contextul market:', e.message);
                }
            }
            const ragContext = yield (0, promptBuilder_1.buildRAGContext)(userQuestion, screen, projectData !== null && projectData !== void 0 ? projectData : {});
            const statusDisclaimer = (0, promptBuilder_1.getStatusDisclaimer)(activeAgents);
            let historyStr = '';
            if (conversationHistory && conversationHistory.length > 0) {
                historyStr =
                    'ISTORIC CONVERSAȚIE:\n' +
                        conversationHistory
                            .slice(-10)
                            .map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`)
                            .join('\n') +
                        '\n\n';
            }
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)({
                userQuestion,
                contextString: enrichedContextString,
                conversationHistory,
                screenContext: screen,
                historySummary,
                activeAgents,
                statusDisclaimer,
                ragContext,
            });
            let lastError = null;
            for (const modelName of aiClient_1.FALLBACK_MODELS_CHAT) {
                for (let attempt = 1; attempt <= aiClient_1.MAX_RETRIES_PER_MODEL; attempt++) {
                    try {
                        const responseStream = yield (0, aiClient_1.getAi)().models.generateContentStream({
                            model: modelName,
                            contents: prompt,
                        });
                        return responseStream;
                    }
                    catch (e) {
                        lastError = e;
                        const is503 = (e === null || e === void 0 ? void 0 : e.status) === 503
                            || ((_a = e === null || e === void 0 ? void 0 : e.error) === null || _a === void 0 ? void 0 : _a.code) === 503
                            || String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : '').includes('503')
                            || String((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : '').toLowerCase().includes('high demand');
                        if (is503 && attempt < aiClient_1.MAX_RETRIES_PER_MODEL) {
                            const delay = attempt * 1500;
                            console.warn(`[agentOrchestrator] 503 la stream cu ${modelName}, retry ${attempt}/${aiClient_1.MAX_RETRIES_PER_MODEL} după ${delay}ms...`);
                            yield new Promise(r => setTimeout(r, delay));
                            continue;
                        }
                        console.warn(`[agentOrchestrator] Eroare/Eșec cu ${modelName}, trecem la următorul model de fallback... Motiv: ${(_d = e === null || e === void 0 ? void 0 : e.message) === null || _d === void 0 ? void 0 : _d.substring(0, 100)}...`);
                        break;
                    }
                }
            }
            console.error(`[agentOrchestrator] Toate modelele au eșuat. Ultima eroare:`, lastError === null || lastError === void 0 ? void 0 : lastError.message);
            throw new Error('Serviciul de asistență tehnică este momentan indisponibil pe toate modelele. Te rugăm să revii mai târziu.');
        });
    },
};
function suggestRoomProgram(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const targetArea = Math.min(Math.max(input.houseAreaSqm, 40), input.plotAreaSqm);
        const purpose = (_a = input.buildingPurpose) !== null && _a !== void 0 ? _a : 'residential';
        // Query-uri specifice per agent — semantic mai apropiat de chunks-urile indexate
        const AGENT_QUERIES = {
            legal: 'suprafata minima camera locuinta dormitor living bucatarie baie hol minim legal',
            architectural: 'suprafata utila minima camera plan locuinta compartimentare zona zi noapte circulatie hol iluminare naturala NP057',
            structural: 'structura rezistenta pereti portanti beton armat grosime planseu',
            geotehnic: 'fundatie teren sol adancime fundare',
            seismic: 'zona seismica etaje inaltime cladire regim inaltime',
        };
        // Agents mereu activi pentru planul functional
        const activeAgents = ['legal', 'architectural', 'structural', 'geotehnic', 'seismic'];
        const contextParts = yield Promise.all(activeAgents.map((agent) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const agentSources = ((_a = normative_registry_1.AGENT_SOURCES_BY_PURPOSE[purpose]) === null || _a === void 0 ? void 0 : _a[agent]) || [];
            if (agentSources.length === 0)
                return null;
            const query = (_b = AGENT_QUERIES[agent]) !== null && _b !== void 0 ? _b : 'plan functional locuinta compartimentare';
            const chunks = yield (0, ragService_1.searchHybrid)(query, agent, 4, agentSources, purpose);
            if (chunks.length === 0)
                return null;
            const chunksText = chunks
                .map(c => `[${c.source} — ${c.chapter}]\n${c.content}`)
                .join('\n\n');
            return `[AGENT ${agent.toUpperCase()}]\n${chunksText}`;
        })));
        const ragContext = contextParts.filter(Boolean).length > 0
            ? contextParts.filter(Boolean).join('\n\n---\n\n')
            : 'Normative generale — zone funcționale și suprafețe minime.';
        const prompt = (0, roomProgramPrompt_1.buildRoomProgramPrompt)({
            input,
            ragContext,
            targetArea,
        });
        let lastError = null;
        for (const modelName of aiClient_1.FALLBACK_MODELS_JSON) {
            for (let attempt = 1; attempt <= aiClient_1.MAX_RETRIES_PER_MODEL; attempt++) {
                try {
                    const response = yield (0, aiClient_1.getAi)().models.generateContent({
                        model: modelName,
                        contents: prompt,
                        config: {
                            temperature: 0.2,
                            responseMimeType: 'application/json'
                        },
                    });
                    const raw = (_b = response.text) !== null && _b !== void 0 ? _b : '';
                    const parsed = (0, roomProgramPrompt_1.validateRoomSuggestion)(JSON.parse(raw), targetArea);
                    console.log(`[suggestRoomProgram] OK (Model: ${modelName}) — ${parsed.rooms.length} camere, ${input.familySize} pers, stil ${input.houseStyle}.`);
                    return parsed;
                }
                catch (e) {
                    lastError = e;
                    const is503 = (e === null || e === void 0 ? void 0 : e.status) === 503
                        || ((_c = e === null || e === void 0 ? void 0 : e.error) === null || _c === void 0 ? void 0 : _c.code) === 503
                        || String((_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : '').includes('503')
                        || String((_e = e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : '').toLowerCase().includes('high demand');
                    const isValidationError = String((_f = e === null || e === void 0 ? void 0 : e.message) !== null && _f !== void 0 ? _f : '').includes('Validare eșuată') || String((_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : '').includes('JSON invalid');
                    if (is503 && attempt < aiClient_1.MAX_RETRIES_PER_MODEL) {
                        const delay = attempt * 1500;
                        console.warn(`[suggestRoomProgram] 503 cu ${modelName}, retry ${attempt}/${aiClient_1.MAX_RETRIES_PER_MODEL} după ${delay}ms...`);
                        yield new Promise(res => setTimeout(res, delay));
                        continue;
                    }
                    if (isValidationError && attempt < aiClient_1.MAX_RETRIES_PER_MODEL) {
                        const delay = attempt * 1500;
                        console.warn(`[suggestRoomProgram] Validare eșuată cu ${modelName}, retry ${attempt}/${aiClient_1.MAX_RETRIES_PER_MODEL} după ${delay}ms... Eroare: ${e === null || e === void 0 ? void 0 : e.message}`);
                        yield new Promise(res => setTimeout(res, delay));
                        continue;
                    }
                    console.warn(`[suggestRoomProgram] Eroare/Eșec cu ${modelName}, trecem la următorul model... Motiv: ${(_h = e === null || e === void 0 ? void 0 : e.message) === null || _h === void 0 ? void 0 : _h.substring(0, 100)}...`);
                    break;
                }
            }
        }
        console.error(`[suggestRoomProgram] Toate modelele au eșuat. Ultima eroare:`, lastError === null || lastError === void 0 ? void 0 : lastError.message);
        throw new Error('Serviciul de asistență este momentan indisponibil pe toate modelele. Te rugăm să încerci din nou.');
    });
}
