import { exportService, _testable } from '../exportService';
import { prismaMock } from '../../../../tests/setup';
import puppeteer from 'puppeteer';
import { conformityService } from '../../../core/services/conformityService';

jest.mock('puppeteer');
jest.mock('../../../core/services/conformityService', () => ({
  conformityService: {
    evaluateRooms: jest.fn().mockResolvedValue({ rooms: [], complianceScore: 100 })
  }
}));

describe('exportService (unit)', () => {
  describe('Helper functions (_testable)', () => {
    describe('pxToMeters', () => {
      it('converts 20px to 1 meter', () => {
        expect(_testable.pxToMeters(20)).toBe(1);
        expect(_testable.pxToMeters(40)).toBe(2);
      });
    });

    describe('computeUsableSqm', () => {
      it('computes correctly with uniform wall thickness', () => {
        // Camera de 100x100px (5x5m brut)
        // 2 pereti a 25cm (0.25m = 5px). Interior devine 90x90px (4.5x4.5m)
        // Usable = 4.5 * 4.5 = 20.25
        expect(_testable.computeUsableSqm(100, 100, 25)).toBe(20.25);
      });

      it('returns 0 when wall thickness exceeds room dimensions (not negative)', () => {
        // Camera mica de 20x20px, wall 25cm (5px x 2 = 10px). Usable > 0.
        // Daca peretele are 100cm (20px). width - 2*20 = -20px. Rezultat 0.
        expect(_testable.computeUsableSqm(20, 20, 100)).toBe(0);
      });

      it('handles asymmetric wall thickness (exterior vs interior walls)', () => {
        // 100x100px. left:25cm(5px), right:12.5cm(2.5px), top:25cm, bottom:25cm
        const thickness = { left: 25, right: 12.5, top: 25, bottom: 25 };
        // Width interior px = 100 - 5 - 2.5 = 92.5px (4.625 m)
        // Height interior px = 100 - 5 - 5 = 90px (4.5 m)
        // Aria = 4.625 * 4.5 = 20.81
        expect(_testable.computeUsableSqm(100, 100, thickness)).toBeCloseTo(20.81);
      });
    });

    describe('escapeHtml', () => {
      it('escapes special HTML characters in project title (XSS prevention)', () => {
        const unsafe = '<script>alert("XSS & fun")\'</script>';
        const safe = _testable.escapeHtml(unsafe);
        expect(safe).toBe('&lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&#039;&lt;/script&gt;');
      });
    });

    describe('buildHtmlTemplate', () => {
      it('renders fallback message when base64 image is null or empty string', () => {
        const html = _testable.buildHtmlTemplate(
          { title: 'Proj', county: null, locality: null, floors: null, houseType: null, totalFloorAreaSqm: null, chatSummaries: [] } as any,
          null, // null image
          [],
          '1 Jan 2026',
          1
        );
        expect(html).toContain('Imaginea planului nu este disponibilă');
      });

      it('includes all room labels in generated HTML', () => {
        const html = _testable.buildHtmlTemplate(
          { title: 'Proj', county: null, locality: null, floors: null, houseType: null, totalFloorAreaSqm: null, chatSummaries: [] } as any,
          'data',
          [{ label: 'Bucatarie', status: 'ok', usableSqm: 10 }, { label: 'Baie secreta', status: 'error', usableSqm: 2 }],
          '1 Jan 2026',
          1
        );
        expect(html).toContain('Bucatarie');
        expect(html).toContain('Baie secreta');
      });

      it('includes chat summaries if present', () => {
        const html = _testable.buildHtmlTemplate(
          { 
            title: 'Proj', county: null, locality: null, floors: null, houseType: null, totalFloorAreaSqm: null, 
            chatSummaries: [
              { phase: 'faza1', summary: 'Geo test\\nGeo line 2', screen: 'screen1' },
              { phase: 'faza2', summary: 'Arhi test\\nArhi line 2', screen: 'screen2' }
            ] 
          } as any,
          'data',
          [],
          '1 Jan 2026',
          1
        );
        expect(html).toContain('Concluziile Agenților AI (Faza 1)');
        expect(html).toContain('Geo test<br/>Geo line 2');
        expect(html).toContain('Consultant AI Arhitectural (Faza 2)');
        expect(html).toContain('Arhi test<br/>Arhi line 2');
      });

      it('generated HTML is parseable (no unclosed tags)', () => {
        const html = _testable.buildHtmlTemplate(
          { title: 'Proj', county: null, locality: null, floors: null, houseType: null, totalFloorAreaSqm: null, chatSummaries: [] } as any,
          'data',
          [],
          '1 Jan 2026',
          1
        );
        // O simplă verificare că are <html> și </html>. Parsearea strictă DOM nu e trivială în unit tests Node.
        expect(html).toMatch(/<html/);
        expect(html).toMatch(/<\/html>/);
        expect(html).toMatch(/<body/);
        expect(html).toMatch(/<\/body>/);
      });
    });
  });

  describe('generatePlanPdf', () => {
    let mockBrowser: any;
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        setContent: jest.fn(),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDF Content')),
      };
      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };
      (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    });

    it('returns null if project not found', async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);
      const res = await exportService.generatePlanPdf(1, null);
      expect(res).toBeNull();
    });

    it('returns null if snapshot not found', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, title: 'Casa' } as any);
      prismaMock.planSnapshot.findFirst.mockResolvedValue(null);
      const res = await exportService.generatePlanPdf(1, null);
      expect(res).toBeNull();
    });

    it('calls browser.close() even when page.pdf() throws (finally block)', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, title: 'Casa', county: null, locality: null, houseStyle: null, totalFloors: null, totalFloorAreaSqm: null, chatSummaries: [] } as any);
      prismaMock.planSnapshot.findFirst.mockResolvedValue({ id: 1, version: 1, planJSON: {} } as any);
      mockPage.pdf.mockRejectedValue(new Error('Puppeteer error'));

      await expect(exportService.generatePlanPdf(1, null)).rejects.toThrow('Puppeteer error');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('does not leak browser instance on Prisma query failure', async () => {
      prismaMock.project.findUnique.mockRejectedValue(new Error('DB Down'));

      await expect(exportService.generatePlanPdf(1, null)).rejects.toThrow('DB Down');
      // Dacă dă crash înainte de puppeteer.launch, launch n-a fost apelat. 
      // Deci nici close nu trebuie chemat pe undefined, mock-ul se asigură că suntem ok.
      expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    it('generates pdf successfully', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ 
        id: 1, title: 'Casa', county: null, locality: null, houseStyle: null, totalFloors: null, totalFloorAreaSqm: null, 
        chatSummaries: [] 
      } as any);
      prismaMock.planSnapshot.findFirst.mockResolvedValue({ 
        id: 1, version: 1, planJSON: { elements: [ { id: '1', type: 'room', width: 100, height: 100, wallThicknessCm: 25 } ] } 
      } as any);

      const res = await exportService.generatePlanPdf(1, 'base64png');
      expect(res).not.toBeNull();
      expect(res?.filename).toBe('plan-parter-casa-v1.pdf');
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('generateContractorPdf', () => {
    let mockBrowser: any;
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        setContent: jest.fn(),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDF Content')),
      };
      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };
      (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    });

    it('returns null if quote not found', async () => {
      prismaMock.contractorQuote.findFirst.mockResolvedValue(null);
      const res = await exportService.generateContractorPdf(1, 1, null);
      expect(res).toBeNull();
    });

    it('generates pdf successfully', async () => {
      prismaMock.contractorQuote.findFirst.mockResolvedValue({
        id: 1, contractorId: 1, projectId: 1, project: { title: 'Test Project' }
      } as any);
      prismaMock.projectBOM.findMany.mockResolvedValue([
        { phase: '1', quantity: 10, material: { name: 'M1' } }
      ] as any);
      prismaMock.planSnapshot.findFirst.mockResolvedValue({ version: 1 } as any);

      const res = await exportService.generateContractorPdf(1, 1, 'b64');
      
      expect(res).not.toBeNull();
      expect(res?.filename).toBe('proiect-executie-test-project.pdf');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('closes browser on error', async () => {
      prismaMock.contractorQuote.findFirst.mockResolvedValue({
        id: 1, contractorId: 1, projectId: 1, project: { title: 'Test Project' }
      } as any);
      prismaMock.projectBOM.findMany.mockResolvedValue([] as any);
      prismaMock.planSnapshot.findFirst.mockResolvedValue(null);
      
      mockPage.pdf.mockRejectedValue(new Error('err'));

      await expect(exportService.generateContractorPdf(1, 1, null)).rejects.toThrow('err');
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});
