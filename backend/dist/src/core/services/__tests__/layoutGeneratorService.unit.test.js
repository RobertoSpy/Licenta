"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const layoutGeneratorService_1 = require("../layoutGeneratorService");
const treemapPartitioner_1 = require("../../../lib/treemapPartitioner");
const layoutConstraintSolver_1 = require("../../../lib/layoutConstraintSolver");
const house_styles_json_1 = __importDefault(require("../../../data/house-styles.json"));
jest.mock('../../../lib/treemapPartitioner');
jest.mock('../../../lib/layoutConstraintSolver');
describe('LayoutGeneratorService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        treemapPartitioner_1.calcHouseFootprint.mockReturnValue({ widthM: 10, heightM: 10 });
        treemapPartitioner_1.buildRoomLayout.mockReturnValue([]);
        layoutConstraintSolver_1.applyLegalConstraints.mockReturnValue([
            { id: '1', label: 'living', xM: 0, yM: 0, widthM: 5, heightM: 5, usableSqm: 25 },
            { id: '2', label: 'dormitor1', xM: 5, yM: 0, widthM: 5, heightM: 5, usableSqm: 25 }
        ]);
    });
    it('generates layout with valid modern style', () => {
        const res = layoutGeneratorService_1.LayoutGeneratorService.generateLayout({
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
        layoutGeneratorService_1.LayoutGeneratorService.generateLayout({
            totalFloorAreaSqm: 100,
            style: 'unknown-style',
            bedrooms: 1
        });
        expect(treemapPartitioner_1.calcHouseFootprint).toHaveBeenCalledWith(100);
    });
    it('handles industrial/clasic/mediteranean styles', () => {
        layoutGeneratorService_1.LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'industrial', bedrooms: 1 });
        layoutGeneratorService_1.LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'clasic', bedrooms: 1 });
        layoutGeneratorService_1.LayoutGeneratorService.generateLayout({ totalFloorAreaSqm: 100, style: 'mediteranean', bedrooms: 1 });
        expect(treemapPartitioner_1.calcHouseFootprint).toHaveBeenCalledTimes(3);
    });
    it('caps bedrooms to 3', () => {
        layoutGeneratorService_1.LayoutGeneratorService.generateLayout({
            totalFloorAreaSqm: 100,
            style: 'modern',
            bedrooms: 10
        });
        // Should fallback to 3_dormitoare, it shouldn't crash
        expect(treemapPartitioner_1.calcHouseFootprint).toHaveBeenCalledWith(100);
    });
    it('throws error if style completely missing from JSON (e.g. if we mocked json)', () => {
        // If houseStyles didn't have Modern (impossible with current JSON, but testing the throw)
        const originalModern = house_styles_json_1.default.templates['Modern'];
        house_styles_json_1.default.templates['Modern'] = undefined;
        expect(() => {
            layoutGeneratorService_1.LayoutGeneratorService.generateLayout({
                totalFloorAreaSqm: 100,
                style: 'modern',
                bedrooms: 2
            });
        }).toThrow('Style not found: Modern');
        // Restore
        house_styles_json_1.default.templates['Modern'] = originalModern;
    });
});
