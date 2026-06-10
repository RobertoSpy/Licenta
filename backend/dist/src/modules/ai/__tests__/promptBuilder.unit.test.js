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
Object.defineProperty(exports, "__esModule", { value: true });
const promptBuilder_1 = require("../services/promptBuilder");
jest.mock('../services/agentRouter', () => ({
    detectRequiredAgents: jest.fn()
}));
jest.mock('../services/ragService', () => ({
    searchHybrid: jest.fn(),
    ragService: {
        searchRelevantMaterialChunks: jest.fn()
    }
}));
jest.mock('../../bom/bomService', () => ({
    bomService: {
        getFoundationSpec: jest.fn().mockReturnValue({ class: 'C20/25' }),
        formatForPrompt: jest.fn().mockReturnValue('Fundatie C20/25'),
        getBOMContextForAI: jest.fn().mockReturnValue('BOM Context')
    }
}));
describe('promptBuilder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('rewriteShortQuery', () => {
        it('ar trebui sa imbunatateasca intrebarile scurte in functie de ecran', () => {
            expect((0, promptBuilder_1.rewriteShortQuery)('ok', 'screen1')).toContain('urbanism');
            expect((0, promptBuilder_1.rewriteShortQuery)('da', 'editor')).toContain('plan arhitectura');
            expect((0, promptBuilder_1.rewriteShortQuery)('next', 'bom')).toContain('deviz estimare');
            expect((0, promptBuilder_1.rewriteShortQuery)('gata', 'screen4')).toContain('stil architectural');
            expect((0, promptBuilder_1.rewriteShortQuery)('am terminat', 'screen3')).toContain('familie reglementari');
            expect((0, promptBuilder_1.rewriteShortQuery)('nu', 'screen2')).toContain('teren fundatie');
        });
        it('ar trebui sa lase intrebarile lungi neschimbate', () => {
            const longQ = 'Vreau sa stiu cati metri cubi de beton intra la fundatie';
            expect((0, promptBuilder_1.rewriteShortQuery)(longQ, 'screen1')).toBe(longQ);
        });
    });
    describe('agentLabel', () => {
        it('ar trebui sa randeze corect etichetele pentru agenti', () => {
            const agents = ['seismic', 'legal'];
            expect((0, promptBuilder_1.agentLabel)(agents)).toBe('Seismicitate & Structură, Legislație & Urbanism');
        });
        it('ar trebui sa foloseasca id-ul brut daca eticheta nu exista', () => {
            expect((0, promptBuilder_1.agentLabel)(['unknown_agent'])).toBe('unknown_agent');
        });
    });
    describe('getStatusDisclaimer', () => {
        it('ar trebui sa adauge disclaimer pentru seismic', () => {
            expect((0, promptBuilder_1.getStatusDisclaimer)(['seismic'])).toContain('P100-1/2013 este versiunea în vigoare');
        });
        it('ar trebui sa adauge disclaimer pentru legal si architectural', () => {
            expect((0, promptBuilder_1.getStatusDisclaimer)(['legal'])).toContain('NP057-2002');
            expect((0, promptBuilder_1.getStatusDisclaimer)(['architectural'])).toContain('NP057-2002');
        });
        it('ar trebui sa le combine daca ambii sunt activi', () => {
            const disclaimer = (0, promptBuilder_1.getStatusDisclaimer)(['seismic', 'legal']);
            expect(disclaimer).toContain('P100-1/2013');
            expect(disclaimer).toContain('NP057-2002');
        });
        it('ar trebui sa returneze string gol daca nu sunt agenti vizati', () => {
            expect((0, promptBuilder_1.getStatusDisclaimer)(['geotehnic'])).toBe('');
        });
    });
    describe('buildRAGContext', () => {
        it('ar trebui sa compuna contextul RAG cu date deterministe', () => __awaiter(void 0, void 0, void 0, function* () {
            const { detectRequiredAgents } = require('../services/agentRouter');
            const { searchHybrid } = require('../services/ragService');
            detectRequiredAgents.mockResolvedValue(['geotehnic']);
            searchHybrid.mockResolvedValue([
                { source: 'NP112', chapter: 'Cap1', content: 'Solutia fundatiei' }
            ]);
            const project = {
                county: 'Cluj',
                seismicZone: '0.20g',
                frostDepthCm: 90
            };
            const result = yield (0, promptBuilder_1.buildRAGContext)('Fundatie?', 'screen2', project);
            expect(result).toContain('[DATE PROIECT — DETERMINISTE]');
            expect(result).toContain('Județ: Cluj');
            expect(result).toContain('Zonă seismică: 0.20g');
            expect(result).toContain('BOM Context');
            expect(result).toContain('[AGENT GEOTEHNIC]');
            expect(result).toContain('§ NP112 — Cap1:');
        }));
        it('ar trebui sa prelucreze materialele via ragService.searchRelevantMaterialChunks daca agentul e "materiale"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { detectRequiredAgents } = require('../services/agentRouter');
            const { ragService } = require('../services/ragService');
            detectRequiredAgents.mockResolvedValue(['materiale']);
            ragService.searchRelevantMaterialChunks.mockResolvedValue('Fisa tehnica BCA');
            const result = yield (0, promptBuilder_1.buildRAGContext)('BCA', 'bom', {});
            expect(result).toContain('[AGENT MATERIALE]');
            expect(result).toContain('Fisa tehnica BCA');
        }));
    });
});
