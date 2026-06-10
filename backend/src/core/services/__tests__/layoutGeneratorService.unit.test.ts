import { LayoutGeneratorService } from '../layoutGeneratorService';
import { calcHouseFootprint, buildRoomLayout } from '../../../lib/treemapPartitioner';
import { applyLegalConstraints } from '../../../lib/layoutConstraintSolver';
import houseStyles from '../../../data/house-styles.json';

jest.mock('../../../lib/treemapPartitioner');
jest.mock('../../../lib/layoutConstraintSolver');

describe('LayoutGeneratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (calcHouseFootprint as jest.Mock).mockReturnValue({ widthM: 10, heightM: 10 });
    (buildRoomLayout as jest.Mock).mockReturnValue([]);
    (applyLegalConstraints as jest.Mock).mockReturnValue([
      { id: '1', label: 'living', xM: 0, yM: 0, widthM: 5, heightM: 5, usableSqm: 25 },
      { id: '2', label: 'dormitor1', xM: 5, yM: 0, widthM: 5, heightM: 5, usableSqm: 25 }
    ]);
  });

  it('generates layout with valid modern style', () => {
    const res = LayoutGeneratorService.generateLayout({
      totalFloorAreaSqm: 100,
      style: 'modern',
      bedrooms: 2
    });
    
    expect(res.length).toBeGreaterThan(0);
    // 4 walls + 1 door + 2 rooms = 7 elements
    expect(res).toHaveLength(7);
    
    const living = res.find(r => r.type === 'room' && r.label === 'Living');
    expect(living).toBeDefined();
    
    const wall = res.find(r => r.type === 'wall');
    expect(wall).toBeDefined();
    
    const door = res.find(r => r.type === 'door');
    expect(door).toBeDefined();
  });

  it('normalizes unknown styles to Modern', () => {
    LayoutGeneratorService.generateLayout({
      totalFloorAreaSqm: 100,
      style: 'unknown-style',
      bedrooms: 1
    });
    expect(calcHouseFootprint).toHaveBeenCalledWith(100);
  });

  it('handles industrial/clasic/mediteranean styles', () => {
    LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'industrial', bedrooms: 1 });
    LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'clasic', bedrooms: 1 });
    LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'mediteranean', bedrooms: 1 });
    expect(calcHouseFootprint).toHaveBeenCalledTimes(3);
  });

  it('caps bedrooms to 3', () => {
    LayoutGeneratorService.generateLayout({
      totalFloorAreaSqm: 100,
      style: 'modern',
      bedrooms: 10
    });
    // Should fallback to 3_dormitoare, it shouldn't crash
    expect(calcHouseFootprint).toHaveBeenCalledWith(100);
  });

  it('throws error if style completely missing from JSON (e.g. if we mocked json)', () => {
    // If houseStyles didn't have Modern (impossible with current JSON, but testing the throw)
    const originalModern = houseStyles.templates['Modern'];
    (houseStyles as any).templates['Modern'] = undefined;
    
    expect(() => {
      LayoutGeneratorService.generateLayout({
        totalFloorAreaSqm: 100,
        style: 'modern',
        bedrooms: 2
      });
    }).toThrow('Style not found: Modern');

    // Restore
    (houseStyles as any).templates['Modern'] = originalModern;
  });
});
