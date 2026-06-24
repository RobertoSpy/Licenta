import { buildContextMultipliers, ProjectContextInput } from '../contextMultiplierEngine';

const MOCK_METRICS = {
  countCorners: 12
};

describe('contextMultiplierEngine', () => {
  describe('buildContextMultipliers', () => {
    it('throws error if planMetrics is not provided', () => {
      expect(() => buildContextMultipliers({})).toThrow(/PlanMetrics este obligatoriu/);
    });

    it('returns default multipliers for unknown soil and ag=0', () => {
      const result = buildContextMultipliers({}, MOCK_METRICS);
      expect(result.seismic_multiplier).toBe(1.0);
      expect(result.soil_concrete_multiplier).toBe(1.05); // default for unknown soil
      expect(result.foundation_width_m).toBe(0.55); // Math.round(0.5 * 1.05 * 20) / 20 = 0.55
      expect(result.frost_depth_m).toBe(0.9); // (80 + 10) / 100
      expect(result.concreteCode).toBe('STANDARD_BETON_C20_25');
      expect(result.concreteClass).toBe('C20/25-XC2');
      expect(result.count_corners_and_intersections).toBe(12);
    });

    it('parses seismicZone properly and selects rule', () => {
      const result = buildContextMultipliers({ seismicZone: '0.35g' }, MOCK_METRICS);
      expect(result.seismic_multiplier).toBe(1.60); // DCH, ag >= 0.35
      expect(result.rebarCode).toBe('STANDARD_FIER_14'); // ag>=0.30 → fier 14mm
    });

    it('selects rule for ag=0.30g', () => {
      const result = buildContextMultipliers({ seismicZone: '0.30g' }, MOCK_METRICS);
      expect(result.seismic_multiplier).toBe(1.45);
    });

    it('selects rule for ag=0.25g', () => {
      const result = buildContextMultipliers({ seismicZone: '0.25g' }, MOCK_METRICS);
      expect(result.seismic_multiplier).toBe(1.30);
    });

    it('selects rule for ag=0.20g', () => {
      const result = buildContextMultipliers({ seismicZone: '0.20' }, MOCK_METRICS); // without g
      expect(result.seismic_multiplier).toBe(1.15);
    });

    it('selects rule for ag=0.10g', () => {
      const result = buildContextMultipliers({ seismicZone: '0.10g' }, MOCK_METRICS);
      expect(result.seismic_multiplier).toBe(1.05);
    });

    it('identifies weak soils correctly', () => {
      const result = buildContextMultipliers({ soilType: 'argilos' }, MOCK_METRICS);
      expect(result.soil_concrete_multiplier).toBe(1.35);

      const result2 = buildContextMultipliers({ soilType: 'mlastinos' }, MOCK_METRICS);
      expect(result2.soil_concrete_multiplier).toBe(1.25);
    });

    it('identifies stable soils correctly', () => {
      const result = buildContextMultipliers({ soilType: 'nisipos' }, MOCK_METRICS);
      expect(result.soil_concrete_multiplier).toBe(1.10);

      const result2 = buildContextMultipliers({ soilType: 'stancă' }, MOCK_METRICS);
      expect(result2.soil_concrete_multiplier).toBe(0.90);
    });

    it('upgrades concrete class on weak soil and high seismic zone', () => {
      const result = buildContextMultipliers({ seismicZone: '0.35g', soilType: 'argilos' }, MOCK_METRICS);
      expect(result.concreteCode).toBe('STANDARD_BETON_C30_37');
      expect(result.concreteClass).toBe('C30/37-XF4');
    });

    it('upgrades concrete class on cold climate (frost > 90)', () => {
      const result = buildContextMultipliers({ frostDepthCm: 100 }, MOCK_METRICS);
      expect(result.concreteCode).toBe('STANDARD_BETON_C25_30');
      expect(result.concreteClass).toBe('C25/30-XF2');
    });

    it('handles basement logic correctly reading from constants', () => {
      const result = buildContextMultipliers({ hasBasement: true }, MOCK_METRICS);
      expect(result.frost_depth_m).toBe(2.80);
      expect(result.basement_sqm_coefficient).toBe(0.50);
    });

    it('rebarCode rămâne STANDARD_FIER_12 pentru zone fără seism ridicat', () => {
      const result = buildContextMultipliers({ houseStyle: 'Modern' }, MOCK_METRICS);
      expect(result.rebarCode).toBe('STANDARD_FIER_12');
    });

    it('calculates foundation width taking floors into account', () => {
      const result = buildContextMultipliers({ totalFloors: 3, soilType: 'argilos' }, MOCK_METRICS);
      expect(result.foundation_width_m).toBe(0.95);
    });
  });
});
