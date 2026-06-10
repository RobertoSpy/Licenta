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
exports.rewriteShortQuery = rewriteShortQuery;
exports.buildRAGContext = buildRAGContext;
exports.agentLabel = agentLabel;
exports.getStatusDisclaimer = getStatusDisclaimer;
const normative_registry_1 = require("../../../data/normative-registry");
const ragService_1 = require("./ragService");
const bomService_1 = require("../../bom/bomService");
const agentRouter_1 = require("./agentRouter");
function rewriteShortQuery(question, screen) {
    const q = question.toLowerCase().trim();
    if (question.length < 15 || ['gata', 'ok', 'am terminat', 'next', 'da', 'nu'].includes(q)) {
        if (screen === 'screen1')
            return 'reglementari urbanism legea 50 certificat urbanism POT CUT maxim etaje';
        if (screen === 'screen2')
            return 'teren fundatie sol zona seismica adancime inghet panta';
        if (screen === 'screen3')
            return 'suprafete minime familie reglementari legea locuintei spatiu minim';
        if (screen === 'screen4')
            return 'stil architectural buget estimare cost materiale';
        if (screen === 'editor')
            return 'plan arhitectura iluminat natural ferestre suprafete minime legea locuintei orientare usi';
        if (screen === 'bom')
            return 'deviz estimare beton armat fier beton zidarie pret manopera';
    }
    return question;
}
function buildRAGContext(question, screen, project) {
    return __awaiter(this, void 0, void 0, function* () {
        const agents = yield (0, agentRouter_1.detectRequiredAgents)(question, screen);
        const limitPerAgent = agents.length === 1 ? 5 : 3;
        console.log(`[buildRAGContext] Agenți activi: [${agents.join(', ')}] pentru screen="${screen}"`);
        const contextParts = yield Promise.all(agents.map((agent) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (agent === 'materiale') {
                const { ragService } = yield Promise.resolve().then(() => __importStar(require('./ragService')));
                const materialChunks = yield ragService.searchRelevantMaterialChunks(question, limitPerAgent);
                if (materialChunks.includes('Nu am găsit'))
                    return null;
                return `[AGENT MATERIALE]\n${materialChunks}`;
            }
            const purpose = (_a = project.buildingPurpose) !== null && _a !== void 0 ? _a : 'residential';
            const agentSources = ((_b = normative_registry_1.AGENT_SOURCES_BY_PURPOSE[purpose]) === null || _b === void 0 ? void 0 : _b[agent]) || [];
            if (agentSources.length === 0)
                return null;
            const augmentedQuery = rewriteShortQuery(question, screen);
            const chunks = yield (0, ragService_1.searchHybrid)(augmentedQuery, agent, limitPerAgent, agentSources, purpose);
            if (chunks.length === 0)
                return null;
            const chunksText = chunks
                .map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`)
                .join('\n\n');
            return `[AGENT ${agent.toUpperCase()}]\n${chunksText}`;
        })));
        const foundationSpec = bomService_1.bomService.getFoundationSpec(project.frostDepthCm, project.soilType);
        const bomContextBlock = bomService_1.bomService.getBOMContextForAI(0, {
            seismicZone: project.seismicZone,
            soilType: project.soilType,
            frostDepthCm: project.frostDepthCm,
            totalFloors: null,
        });
        const fullProjectLines = [
            '[DATE PROIECT — DETERMINISTE]',
            project.county ? `Județ: ${project.county}` : null,
            project.locality ? `Localitate: ${project.locality}` : null,
            project.seismicZone ? `Zonă seismică: ${project.seismicZone} (P100-1-2013, Anexa A)` : null,
            project.frostDepthCm ? `Adâncime îngheț: ${project.frostDepthCm} cm (NP112-2014, Anexa B)` : null,
            project.soilType ? `Tip sol: ${project.soilType}` : null,
            project.windPressureKpa ? `Presiune vânt qb: ${project.windPressureKpa} kPa (CR1-1-4-2012, Anexa A)` : null,
            project.terrainCategory ? `Categorie teren rugozitate: ${project.terrainCategory}` : null,
            project.frostDepthCm ? bomService_1.bomService.formatForPrompt(foundationSpec) : null,
        ].filter(Boolean).join('\n');
        return [
            fullProjectLines,
            bomContextBlock,
            ...contextParts.filter(Boolean),
        ].join('\n\n---\n\n');
    });
}
function agentLabel(agents) {
    const labels = {
        geotehnic: 'Geotehnică & Fundații',
        seismic: 'Seismicitate & Structură',
        structural: 'Structuri & Materiale',
        architectural: 'Arhitectură & Reglementări',
        legal: 'Legislație & Urbanism',
        materiale: 'Cataloage Materiale',
        deviz: 'Deviz & Estimare Costuri',
        energetic: 'Eficiență Energetică',
        instalatii: 'Instalații Sanitare & Electrice',
        general: 'General',
        financial: 'Analiză Piață & Costuri INSSE',
    };
    return agents.map(a => labels[a] || a).join(', ');
}
function getStatusDisclaimer(agents) {
    let disclaimer = '';
    if (agents.includes('seismic')) {
        disclaimer += '\n⚠️ **Notă normativ:** P100-1/2013 este versiunea în vigoare. P100-1/2025 este în stadiu de redactare și nu a intrat în vigoare.\n';
    }
    if (agents.includes('legal') || agents.includes('architectural')) {
        disclaimer += '\n⚠️ **Notă normativ:** NP057-2002 (normativul locuințelor) se află pe lista MDLPA de reglementări propuse spre revizuire. Cifrele folosite reprezintă prevederile legal în vigoare la acest moment.\n';
    }
    return disclaimer;
}
