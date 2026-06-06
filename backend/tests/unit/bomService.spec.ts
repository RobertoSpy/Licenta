import { bomService } from '../../src/modules/bom/bomService';

describe('BOM Service Module (Mathematical Logic)', () => {
  describe('Foundation Specifications Calculator', () => {
    it('ar trebui sa impuna beton clasa superioara (C25/30-XF2) pentru inghet sever (>90cm)', () => {
      const spec = bomService.getFoundationSpec(100, 'Argila');
      expect(spec.concreteClass).toBe('C25/30-XF2');
      expect(spec.minDepthCm).toBe(110); // frost + 10
      expect(spec.note).toContain('impune minim C25/30');
    });

    it('ar trebui sa sugereze beton standard (C20/25-XC2) pentru inghet normal (<=90cm)', () => {
      const spec = bomService.getFoundationSpec(80, 'Nisipos');
      expect(spec.concreteClass).toBe('C20/25-XC2');
      expect(spec.minDepthCm).toBe(90);
      expect(spec.note).toContain('permite C20/25');
    });

    it('ar trebui sa returneze minimul legal constructiv de 80cm de fundare in lipsa datelor precise', () => {
      // Daca ii trimitem un frostDepth exagerat de mic (ex: 20cm), normativul NP112 impune totusi un minim
      const spec = bomService.getFoundationSpec(20, 'Stanca');
      // in cod `Math.max(frost + 10, 80)` -> max(30, 80) = 80
      expect(spec.minDepthCm).toBe(80); 
    });
  });
});
