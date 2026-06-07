import { rewriteShortQuery, agentLabel, getStatusDisclaimer, buildRAGContext } from '../services/promptBuilder';
import { AgentType } from '../../../data/normative-registry';

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
      expect(rewriteShortQuery('ok', 'screen1')).toContain('urbanism');
      expect(rewriteShortQuery('da', 'editor')).toContain('plan arhitectura');
      expect(rewriteShortQuery('next', 'bom')).toContain('deviz estimare');
      expect(rewriteShortQuery('gata', 'screen4')).toContain('stil architectural');
      expect(rewriteShortQuery('am terminat', 'screen3')).toContain('familie reglementari');
      expect(rewriteShortQuery('nu', 'screen2')).toContain('teren fundatie');
    });

    it('ar trebui sa lase intrebarile lungi neschimbate', () => {
      const longQ = 'Vreau sa stiu cati metri cubi de beton intra la fundatie';
      expect(rewriteShortQuery(longQ, 'screen1')).toBe(longQ);
    });
  });

  describe('agentLabel', () => {
    it('ar trebui sa randeze corect etichetele pentru agenti', () => {
      const agents: AgentType[] = ['seismic', 'legal'];
      expect(agentLabel(agents)).toBe('Seismicitate & Structură, Legislație & Urbanism');
    });

    it('ar trebui sa foloseasca id-ul brut daca eticheta nu exista', () => {
      expect(agentLabel(['unknown_agent' as any])).toBe('unknown_agent');
    });
  });

  describe('getStatusDisclaimer', () => {
    it('ar trebui sa adauge disclaimer pentru seismic', () => {
      expect(getStatusDisclaimer(['seismic'])).toContain('P100-1/2013 este versiunea în vigoare');
    });

    it('ar trebui sa adauge disclaimer pentru legal si architectural', () => {
      expect(getStatusDisclaimer(['legal'])).toContain('NP057-2002');
      expect(getStatusDisclaimer(['architectural'])).toContain('NP057-2002');
    });

    it('ar trebui sa le combine daca ambii sunt activi', () => {
      const disclaimer = getStatusDisclaimer(['seismic', 'legal']);
      expect(disclaimer).toContain('P100-1/2013');
      expect(disclaimer).toContain('NP057-2002');
    });

    it('ar trebui sa returneze string gol daca nu sunt agenti vizati', () => {
      expect(getStatusDisclaimer(['geotehnic'])).toBe('');
    });
  });

  describe('buildRAGContext', () => {
    it('ar trebui sa compuna contextul RAG cu date deterministe', async () => {
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

      const result = await buildRAGContext('Fundatie?', 'screen2', project);
      
      expect(result).toContain('[DATE PROIECT — DETERMINISTE]');
      expect(result).toContain('Județ: Cluj');
      expect(result).toContain('Zonă seismică: 0.20g');
      expect(result).toContain('BOM Context');
      expect(result).toContain('[AGENT GEOTEHNIC]');
      expect(result).toContain('§ NP112 — Cap1:');
    });

    it('ar trebui sa prelucreze materialele via ragService.searchRelevantMaterialChunks daca agentul e "materiale"', async () => {
      const { detectRequiredAgents } = require('../services/agentRouter');
      const { ragService } = require('../services/ragService');

      detectRequiredAgents.mockResolvedValue(['materiale']);
      ragService.searchRelevantMaterialChunks.mockResolvedValue('Fisa tehnica BCA');

      const result = await buildRAGContext('BCA', 'bom', {});
      
      expect(result).toContain('[AGENT MATERIALE]');
      expect(result).toContain('Fisa tehnica BCA');
    });
  });
});
