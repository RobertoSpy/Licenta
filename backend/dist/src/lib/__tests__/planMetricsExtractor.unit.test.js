"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const planMetricsExtractor_1 = require("../planMetricsExtractor");
describe('planMetricsExtractor', () => {
    it('returns fallback if planJSON is invalid', () => {
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(null, 2, 1, 0.5);
        expect(res.fromSnapshot).toBe(false);
        expect(res.metrics.totalFloorAreaSqm).toBe(200); // 100 * 2 floors
        expect(res.metrics.perimeterM).toBe(40);
    });
    it('returns fallback if no rooms are found', () => {
        const planJSON = { elements: [{ type: 'wall', x: 0, y: 0, width: 100, height: 10 }] };
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(planJSON, 1, 1, 0.5);
        expect(res.fromSnapshot).toBe(false);
    });
    it('calculates metrics from snapshot correctly', () => {
        const PIXELS_PER_METER = 20;
        const planJSON = {
            elements: [
                { type: 'room', x: 0, y: 0, width: 10 * PIXELS_PER_METER, height: 10 * PIXELS_PER_METER }, // 10x10m = 100sqm
                { type: 'wall', x: 0, y: 0, width: 10 * PIXELS_PER_METER, height: 10 }, // 10m wall
                { type: 'door', x: 0, y: 0, width: 0.9 * PIXELS_PER_METER, height: 10, metadata: { isExterior: true } }, // 0.9m door
                { type: 'door', x: 50, y: 50, width: 0.8 * PIXELS_PER_METER, height: 10, metadata: { isExterior: false } }, // inner door
                { type: 'window', x: 0, y: 0, width: 2 * PIXELS_PER_METER, height: 10 } // 2m window
            ]
        };
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(planJSON, 1, 1.2, 0.6);
        expect(res.fromSnapshot).toBe(true);
        expect(res.metrics.totalFloorAreaSqm).toBe(100);
        expect(res.metrics.perimeterM).toBe(10); // Since we have 1 wall of 10m
        expect(res.metrics.countDoors).toBe(2);
        expect(res.metrics.countExteriorDoors).toBe(1);
        expect(res.metrics.countInteriorDoors).toBe(1);
        expect(res.metrics.countWindows).toBe(1);
        expect(res.metrics.foundationDepthM).toBe(1.2);
        expect(res.metrics.foundationWidthM).toBe(0.6);
    });
    it('deduces exterior doors from geometry if metadata is missing', () => {
        const PIXELS_PER_METER = 20;
        const planJSON = {
            elements: [
                { type: 'room', x: 0, y: 0, width: 10 * PIXELS_PER_METER, height: 10 * PIXELS_PER_METER }, // bbox: 0,0 -> 200,200
                // door at x: 5, y: 5 => center is around 5+width/2. This is close to minX (0), threshold is 40. Should be exterior.
                { type: 'door', x: 5, y: 5, width: 10, height: 10 }
            ]
        };
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(planJSON, 1, 1, 0.5);
        expect(res.metrics.countExteriorDoors).toBe(1);
    });
    it('deduces interior doors from geometry if metadata is missing', () => {
        const PIXELS_PER_METER = 20;
        const planJSON = {
            elements: [
                { type: 'room', x: 0, y: 0, width: 10 * PIXELS_PER_METER, height: 10 * PIXELS_PER_METER }, // bbox: 0,0 -> 200,200
                // door at center 100, 100
                { type: 'door', x: 90, y: 90, width: 20, height: 20 }
            ]
        };
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(planJSON, 1, 1, 0.5);
        expect(res.metrics.countExteriorDoors).toBe(0);
        expect(res.metrics.countInteriorDoors).toBe(1);
    });
    it('uses bbox perimeter if no walls are provided', () => {
        const PIXELS_PER_METER = 20;
        const planJSON = {
            elements: [
                { type: 'room', x: 0, y: 0, width: 5 * PIXELS_PER_METER, height: 5 * PIXELS_PER_METER },
                { type: 'room', x: 100, y: 100, width: 5 * PIXELS_PER_METER, height: 5 * PIXELS_PER_METER }
            ]
        };
        // Bbox should be 0,0 to 200,200 => 10m x 10m.
        // perimeter fallback = 2 * (10 + 10) = 40.
        const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(planJSON, 1, 1, 0.5);
        expect(res.metrics.perimeterM).toBe(40);
    });
});
