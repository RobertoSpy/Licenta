import { conformityService } from '../conformityService';
import * as conformityRulesCache from '../../../lib/conformityRulesCache';

jest.mock('../../../lib/conformityRulesCache');

describe('conformityService (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (conformityRulesCache.getSupplementalRules as jest.Mock).mockResolvedValue([]);
  });

  describe('Surface Boundaries (Suprafață Minimă)', () => {
    describe('Living (minimum 18.0 sqm)', () => {
      it('living at exactly 18.0sqm returns status ok', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 18.0 }]);
        expect(result.rooms[0].status).toBe('ok');
        expect(result.violations).toHaveLength(0);
      });

      it('living at 17.99sqm returns status warning (within 90% = 16.2sqm threshold)', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 17.99 }]);
        expect(result.rooms[0].status).toBe('warning');
        expect(result.warnings).toHaveLength(1);
      });

      it('living at 16.19sqm returns status error (below 90% of 18sqm)', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 16.19 }]);
        expect(result.rooms[0].status).toBe('error');
        expect(result.violations).toHaveLength(1);
      });

      it('living at 0sqm returns status error, not throws', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 0 }]);
        expect(result.rooms[0].status).toBe('error');
        expect(result.violations).toHaveLength(1);
      });
    });

    describe('Dormitor (minimum 12.0 sqm, conform JSON)', () => {
      it('dormitor at 12.0sqm returns ok', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 12.0 }]);
        expect(result.rooms[0].status).toBe('ok');
      });

      it('dormitor la 10.8sqm returns warning', async () => {
        // 90% of 12.0 = 10.8
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 10.8 }]);
        expect(result.rooms[0].status).toBe('warning');
      });

      it('dormitor la 10.79sqm returns error', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 10.79 }]);
        expect(result.rooms[0].status).toBe('error');
      });
    });

    describe('Unrecognized and Special Labels', () => {
      it('room with unrecognized label returns status ok (no false positives)', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Camera Misterioasa', usableSqm: 2.0 }]);
        expect(result.rooms[0].status).toBe('ok');
      });

      it('room labeled "Debara" has no minimum surface requirement', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Debara', usableSqm: 5.0 }]);
        expect(result.rooms[0].status).toBe('ok');
      });

      it('room label matching is case-insensitive ("LIVING" === "living")', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'LIVING', usableSqm: 10.0 }]); // Sub 16.2
        expect(result.rooms[0].status).toBe('error'); // Must catch as Living
      });

      it('room label with number is normalized correctly ("Dormitor 1" → dormitor)', async () => {
        const result = await conformityService.evaluateRooms([{ id: '1', label: 'Dormitor 1', usableSqm: 5.0 }]); // Sub 8.1
        expect(result.rooms[0].status).toBe('error'); // Must catch as Dormitor
      });
    });
  });

  describe('Garage Exterior Access Rule', () => {
    it('garage with exterior door element returns no access error', async () => {
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: true }]);
      expect(result.rooms[0].status).toBe('ok');
      expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeFalsy();
    });

    it('garage with only interior door elements returns GARAGE_NO_EXTERIOR_ACCESS error', async () => {
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: false }]);
      expect(result.rooms[0].status).toBe('error');
      expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeTruthy();
    });

    it('garage with no door elements returns GARAGE_NO_EXTERIOR_ACCESS error', async () => {
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: false }]);
      expect(result.rooms[0].status).toBe('error');
      expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeTruthy();
    });

    it('garage rule does not apply to rooms not labeled as garage/garaj', async () => {
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 20, hasExteriorAccess: false }]);
      expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeFalsy();
    });
  });

  describe('RAG / getSupplementalRules Mock Isolation', () => {
    it('evaluateRooms does not call getSupplementalRules when all rules are deterministic', async () => {
      // O cameră "Living" fără coridoare și fără uși furnizate -> e pur determinist
      await conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 20 }]);
      expect(conformityRulesCache.getSupplementalRules).not.toHaveBeenCalled();
    });

    it('evaluateRooms completes successfully when getSupplementalRules mock returns empty array', async () => {
      // Declanșăm RAG prin adăugarea unui coridor
      (conformityRulesCache.getSupplementalRules as jest.Mock).mockResolvedValue([]);
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Coridor', usableSqm: 10, widthM: 1.0, heightM: 5.0 }]);
      
      expect(conformityRulesCache.getSupplementalRules).toHaveBeenCalled();
      // Verificăm dacă fallback-ul JSON pt coridor e aplicat (minim 1.2m vs 1.0m din test)
      expect(result.rooms[0].status).toBe('error');
      expect(result.violations[0].code).toBe('L114_CORRIDOR_WIDTH');
    });

    it('evaluateRooms does not throw when getSupplementalRules mock throws (graceful degradation)', async () => {
      (conformityRulesCache.getSupplementalRules as jest.Mock).mockRejectedValue(new Error('AI Service Down'));
      
      const result = await conformityService.evaluateRooms([{ id: '1', label: 'Hol', usableSqm: 10, widthM: 1.0, heightM: 5.0 }]);
      
      // Chiar dacă aruncă RAG-ul, ar trebui să folosească fallback JSON
      expect(result.rooms[0].status).toBe('error');
      expect(result.violations[0].code).toBe('L114_CORRIDOR_WIDTH');
    });
  });
});
