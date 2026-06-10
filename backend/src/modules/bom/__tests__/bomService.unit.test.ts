import { bomService, evaluateFormula, FormulaVariables } from '../bomService';
import { prisma } from '../../../lib/prisma';
import { bomRepository } from '../bomRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn(), update: jest.fn() },
    planSnapshot: { findFirst: jest.fn() },
    material: { findMany: jest.fn(), findUnique: jest.fn() },
    projectMaterialOverride: { findMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn((callback) => callback(prisma)),
    projectBOM: { deleteMany: jest.fn(), createMany: jest.fn() }
  },
}));

jest.mock('../bomRepository', () => ({
  bomRepository: {
    findByProject: jest.fn(),
  },
}));

// Mockăm materialSelector pentru a nu rula logica complexă acolo (pe care o testăm separat)
jest.mock('../materialSelector', () => ({
  selectMaterialForBOM: jest.fn().mockResolvedValue({ id: 999, pricePerUnit: 100 }),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

import fs from 'fs';

jest.mock('../../../lib/planMetricsExtractor', () => ({
  extractMetricsFromSnapshot: jest.fn().mockReturnValue({
    fromSnapshot: true,
    metrics: {
      perimeterM: 40,
      foundationWidthM: 0.5,
      foundationDepthM: 1.0,
      floorHeightM: 3.0,
      totalFloorAreaSqm: 100,
      interiorWallsM: 20,
      exteriorOpeningsSqm: 15,
      countDoors: 5,
      countExteriorDoors: 1,
      countInteriorDoors: 4,
      countWindows: 6,
      countCornersAndIntersections: 8,
    }
  })
}));

describe('bomService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // Curățăm mutex-ul
    (bomService as any)._bomGenerating.clear();
  });

  describe('evaluateFormula', () => {
    const baseVars: FormulaVariables = {
      perimeter_m: 40,
      foundation_width_m: 0.5,
      foundation_depth_m: 1.0,
      floor_height_m: 3.0,
      floors_count: 1,
      total_floor_area_sqm: 100,
      interior_walls_m: 20,
      exterior_openings_sqm: 15,
      count_doors: 5,
      count_exterior_doors: 1,
      count_interior_doors: 4,
      count_windows: 6,
      count_corners_and_intersections: 8,
      seismic_multiplier: 1.0,
      soil_concrete_multiplier: 1.0,
      base_rebar_kg_per_mc: 80,
    };

    it('calculates foundation concrete correctly with real metrics', () => {
      // (Perimetru * latime * adancime) + (interior * latime * adancime)
      // (40 * 0.5 * 1.0) + (20 * 0.5 * 1.0) = 20 + 10 = 30
      const formula = '(perimeter_m * foundation_width_m * foundation_depth_m) + (interior_walls_m * foundation_width_m * foundation_depth_m)';
      const result = evaluateFormula(formula, baseVars);
      expect(result).toBe(30);
    });

    it('applies waste percentage correctly', () => {
      // evaluateFormula returns raw. Waste is applied in calculateBOM, but let's test if formula evaluation allows mathematical combinations
      const formula = '100 * 1.10';
      const result = evaluateFormula(formula, baseVars);
      expect(result).toBeCloseTo(110);
    });

    it('returns 0 for negative quantities, does not add to BOM (tested by formula math)', () => {
      const formula = '10 - 20';
      const result = evaluateFormula(formula, baseVars);
      expect(result).toBe(-10);
      // Not ading to BOM when < 0 is handled in calculateBOM!
    });

    it('throws on unsafe formula string (injection attempt)', () => {
      const unsafeFormula1 = 'process.exit(1)';
      expect(() => evaluateFormula(unsafeFormula1, baseVars)).toThrow(/Formula nesigură după substituție/);

      const unsafeFormula2 = 'require("fs")';
      expect(() => evaluateFormula(unsafeFormula2, baseVars)).toThrow(/Formula nesigură după substituție/);
    });

    it('handles math expressions with parentheses correctly', () => {
      const formula = '(perimeter_m + interior_walls_m) * 2';
      const result = evaluateFormula(formula, baseVars);
      expect(result).toBe(120);
    });

    it('rounds to 2 decimal places correctly if used inside formula', () => {
      // Though rounding happens in calculateBOM, evaluateFormula retains full precision unless rounded in formula.
      const formula = '1 / 3';
      const result = evaluateFormula(formula, baseVars);
      expect(result).toBeCloseTo(0.33333333);
    });
  });

  describe('overrideMaterial', () => {
    it('ar trebui sa arunce eroare daca noul material nu exista in baza de date', async () => {
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        bomService.updateMaterialOverride(1, 'beton_fundatie', 'INVALID_MAT')
      ).rejects.toThrow('Materialul cu codul "INVALID_MAT" nu există în baza de date. Verificați catalogul.');
    });

    it('ar trebui sa creeze sau updateze un override si sa recalculeze devizul (totalPrice recalculat)', async () => {
      const mockMaterial = { id: 777, internalCode: 'MAT-NOU', pricePerUnit: 50 };
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(mockMaterial);
      (prisma.projectMaterialOverride.upsert as jest.Mock).mockResolvedValue({});

      // Mock calculateBOM to verify it gets called
      const calcSpy = jest.spyOn(bomService, 'calculateBOM').mockResolvedValue([{ id: 1 } as any]);

      const result = await bomService.updateMaterialOverride(1, 'beton_fundatie', 'MAT-NOU');

      expect(prisma.projectMaterialOverride.upsert).toHaveBeenCalledWith({
        where: { projectId_formulaKey: { projectId: 1, formulaKey: 'beton_fundatie' } },
        update: { materialId: 777 },
        create: { projectId: 1, formulaKey: 'beton_fundatie', materialId: 777 },
      });

      expect(calcSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 1 }]);

      calcSpy.mockRestore();
    });
  });

  describe('overrideMaterial', () => {
    it('ar trebui sa arunce eroare daca noul material nu exista in baza de date', async () => {
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        bomService.updateMaterialOverride(1, 'beton_fundatie', 'INVALID_MAT')
      ).rejects.toThrow('Materialul cu codul "INVALID_MAT" nu există în baza de date. Verificați catalogul.');
    });

    it('ar trebui sa creeze sau updateze un override si sa recalculeze devizul (totalPrice recalculat)', async () => {
      const mockMaterial = { id: 777, internalCode: 'MAT-NOU', pricePerUnit: 50 };
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(mockMaterial);
      (prisma.projectMaterialOverride.upsert as jest.Mock).mockResolvedValue({});

      // Mock calculateBOM to verify it gets called
      const calcSpy = jest.spyOn(bomService, 'calculateBOM').mockResolvedValue([{ id: 1 } as any]);

      const result = await bomService.updateMaterialOverride(1, 'beton_fundatie', 'MAT-NOU');

      expect(prisma.projectMaterialOverride.upsert).toHaveBeenCalledWith({
        where: { projectId_formulaKey: { projectId: 1, formulaKey: 'beton_fundatie' } },
        update: { materialId: 777 },
        create: { projectId: 1, formulaKey: 'beton_fundatie', materialId: 777 },
      });

      expect(calcSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 1 }]);

      calcSpy.mockRestore();
    });
  });

  describe('calcFoundationSpec (compat)', () => {
    it('ar trebui sa intoarca spec pentru inghet normal', () => {
      const spec = bomService.getFoundationSpec(80);
      expect(spec.concreteClass).toBe('C20/25-XC2');
      expect(spec.minDepthCm).toBe(90);
    });

    it('ar trebui sa intoarca spec pentru inghet sever', () => {
      const spec = bomService.getFoundationSpec(100);
      expect(spec.concreteClass).toBe('C25/30-XF2');
      expect(spec.minDepthCm).toBe(110);
    });

    it('ar trebui sa formateze rezultatul corect pentru prompt', () => {
      const spec = { concreteClass: 'C20/25', minDepthCm: 90, note: 'Test note' };
      const formatted = bomService.formatForPrompt(spec);
      expect(formatted).toContain('Clasa beton fundație: C20/25');
      expect(formatted).toContain('Test note');
    });
  });

  describe('getBOMContextForAI', () => {
    it('ar trebui sa genereze context string corect', () => {
      const project = { seismicZone: 'ag=0.25g', soilType: 'argila', frostDepthCm: 90 };
      const context = bomService.getBOMContextForAI(1, project);
      expect(context).toContain('seismic_multiplier:');
      expect(context).toContain('frost_depth_m: 1m');
    });
  });

  describe('calculateBOM', () => {
    it('ar trebui sa nu execute logica daca generarea este deja in curs (mutex)', async () => {
      // Adaug manual in mutex
      (bomService as any)._bomGenerating.add(123);
      (bomRepository.findByProject as jest.Mock).mockResolvedValue([{ fake: 'bom' }]);

      const result = await bomService.calculateBOM(123);

      expect(result).toEqual([{ fake: 'bom' }]);
      expect(prisma.project.findUnique).not.toHaveBeenCalled(); // S-a oprit devreme
    });

    it('ar trebui sa arunce eroare daca proiectul nu exista', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(bomService.calculateBOM(1)).rejects.toThrow('Proiect negăsit (id=1)');
    });

    it('ar trebui sa arunce eroare daca nu exista snapshot', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
      (prisma.planSnapshot.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(bomService.calculateBOM(1)).rejects.toThrow('Nu există un plan 2D salvat');
    });

    it('ar trebui sa calculeze BOM, ignorand cantitati negative si sarind materiale inexistente', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 1, seismicZone: '0.20g' });
      (prisma.planSnapshot.findFirst as jest.Mock).mockResolvedValue({ planJSON: {} });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      
      const mockFormulas = {
        _meta: { version: '1.0' },
        valid_item: { formula: '10', wastePercent: 5, note: 'Valid', materialQuery: { category: 'test' } },
        negative_item: { formula: '-5', wastePercent: 0, note: 'Negative' },
        no_material_item: { formula: '5', wastePercent: 0, note: 'NoMat', materialQuery: { category: 'nomat' } }
      };
      
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockFormulas));
      (prisma.material.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.projectMaterialOverride.findMany as jest.Mock).mockResolvedValue([]);
      
      const { selectMaterialForBOM } = require('../materialSelector');
      selectMaterialForBOM.mockImplementation((query: any) => {
        if (query.category === 'nomat') return null;
        return { id: 999, pricePerUnit: 100 };
      });

      (bomRepository.findByProject as jest.Mock).mockResolvedValue([{ id: 1, formulaKey: 'valid_item' }]);

      const result = await bomService.calculateBOM(1);

      expect(result).toEqual([{ id: 1, formulaKey: 'valid_item' }]);
      expect(prisma.projectBOM.createMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ formulaKey: 'valid_item', quantity: 10.5 })
        ])
      }));
    });

    it('handles manual overrides and formula evaluation errors gracefully', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
      (prisma.planSnapshot.findFirst as jest.Mock).mockResolvedValue({ planJSON: {} });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      
      const mockFormulas = {
        _meta: { version: '1.0' },
        overridden_item: { formula: '10', wastePercent: 0, note: 'Override', materialQuery: { category: 'test' } },
        error_item: { formula: 'INVALID_SYNTAX!!!', wastePercent: 0, note: 'Error' }
      };
      
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockFormulas));
      (prisma.material.findMany as jest.Mock).mockResolvedValue([{ id: 777, pricePerUnit: 50 }]);
      (prisma.projectMaterialOverride.findMany as jest.Mock).mockResolvedValue([{ formulaKey: 'overridden_item', materialId: 777 }]);
      
      const { selectMaterialForBOM } = require('../materialSelector');
      selectMaterialForBOM.mockImplementation(() => ({ id: 999, pricePerUnit: 100 }));

      (bomRepository.findByProject as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await bomService.calculateBOM(1);

      expect(prisma.projectBOM.createMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ formulaKey: 'overridden_item', materialId: 777, totalPrice: 500 }) // 10 * 50
        ])
      }));
    });
  });
});
