"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contextMultiplierEngine_1 = require("../contextMultiplierEngine");
describe('contextMultiplierEngine', () => {
    describe('buildContextMultipliers', () => {
        it('returns default multipliers when no input provided', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({});
            expect(result.seismic_multiplier).toBe(1.0);
            expect(result.soil_concrete_multiplier).toBe(1.05); // default for unknown soil
            expect(result.foundation_width_m).toBe(0.55); // Math.round(0.5 * 1.05 * 20) / 20 = 0.55
            expect(result.frost_depth_m).toBe(0.9); // (80 + 10) / 100
            expect(result.concreteCode).toBe('STANDARD_BETON_C20_25');
            expect(result.concreteClass).toBe('C20/25-XC2');
        });
        it('parses seismicZone properly and selects rule', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.35g' });
            expect(result.seismic_multiplier).toBe(1.60); // DCH, ag >= 0.35
            expect(result.exteriorWallCode).toBe('CARAMIDA_POROTHERM_38');
            expect(result.rebarCode).toBe('STANDARD_FIER_14');
        });
        it('selects rule for ag=0.30g', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.30g' });
            expect(result.seismic_multiplier).toBe(1.45);
        });
        it('selects rule for ag=0.25g', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.25g' });
            expect(result.seismic_multiplier).toBe(1.30);
        });
        it('selects rule for ag=0.20g', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.20g' });
            expect(result.seismic_multiplier).toBe(1.15);
        });
        it('selects rule for ag=0.10g', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.10g' });
            expect(result.seismic_multiplier).toBe(1.05);
        });
        it('identifies weak soils correctly', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ soilType: 'argilos' });
            expect(result.soil_concrete_multiplier).toBe(1.35);
            const result2 = (0, contextMultiplierEngine_1.buildContextMultipliers)({ soilType: 'mlastinos' });
            expect(result2.soil_concrete_multiplier).toBe(1.25);
        });
        it('identifies stable soils correctly', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ soilType: 'nisipos' });
            expect(result.soil_concrete_multiplier).toBe(1.10);
            const result2 = (0, contextMultiplierEngine_1.buildContextMultipliers)({ soilType: 'stancă' });
            expect(result2.soil_concrete_multiplier).toBe(0.90);
        });
        it('upgrades concrete class on weak soil and high seismic zone', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ seismicZone: '0.35g', soilType: 'argilos' });
            expect(result.concreteCode).toBe('STANDARD_BETON_C30_37');
            expect(result.concreteClass).toBe('C30/37-XF4');
        });
        it('upgrades concrete class on cold climate (frost > 90)', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ frostDepthCm: 100 });
            expect(result.concreteCode).toBe('STANDARD_BETON_C25_30');
            expect(result.concreteClass).toBe('C25/30-XF2');
            expect(result.exteriorWallCode).toBe('BCA_YTONG_30');
            expect(result.insulationRoofCode).toBe('VATA_MINERALA_20');
            expect(result.windowsCode).toBe('FEREASTRA_PVC_3K');
        });
        it('handles basement logic correctly', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ hasBasement: true });
            expect(result.frost_depth_m).toBe(2.80);
            expect(result.concrete_note).toContain('[SĂPĂTURĂ/FUNDAȚIE ADÂNCĂ pt. SUBSOL (2.8m)]');
        });
        it('determines windows code based on style and energy class', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ houseStyle: 'Modern' });
            expect(result.windowsCode).toBe('FEREASTRA_ALUMINIU');
            const result2 = (0, contextMultiplierEngine_1.buildContextMultipliers)({ energyClass: 'A' });
            expect(result2.windowsCode).toBe('FEREASTRA_PVC_3K');
        });
        it('calculates foundation width taking floors into account', () => {
            // Base: 0.5 + (floors-1)*0.10. 
            // Floors: 3 => base = 0.5 + 0.2 = 0.7
            // Soil (argila): 1.35
            // 0.7 * 1.35 = 0.945 => Math.round(0.945 * 20) / 20 = 19/20 = 0.95
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({ totalFloors: 3, soilType: 'argilos' });
            expect(result.foundation_width_m).toBe(0.95);
        });
        it('uses planMetrics if provided', () => {
            const result = (0, contextMultiplierEngine_1.buildContextMultipliers)({}, {
                interiorWallsM: 9,
                countWindows: 2,
                countExteriorDoors: 1
            });
            // corners: 4 + floor(9/4.5) + 2 + 1 = 4 + 2 + 2 + 1 = 9
            expect(result.count_corners_and_intersections).toBe(9);
        });
    });
});
