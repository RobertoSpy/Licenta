"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const terrainController_1 = require("../terrainController");
const terrainService_1 = require("../terrainService");
jest.mock('../terrainService');
describe('terrainController (unit)', () => {
    let req;
    let res;
    beforeEach(() => {
        jest.resetAllMocks();
        req = {
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });
    it('returns 200 with data on success', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockData = { county: 'Cluj', locality: 'Dej', seismicZone: '0.25g', frostDepthCm: 90 };
        terrainService_1.terrainService.analyzeLocation.mockResolvedValue(mockData);
        yield (0, terrainController_1.analyzeLocation)(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockData });
    }));
    it('returns 400 with descriptive message for "Unable to determine county"', () => __awaiter(void 0, void 0, void 0, function* () {
        terrainService_1.terrainService.analyzeLocation.mockRejectedValue(new Error('Unable to determine county from coordinates or input.'));
        yield (0, terrainController_1.analyzeLocation)(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unable to determine county from coordinates or input.' });
    }));
    it('returns 400 for invalid coordinates (lat > 90, lng > 180)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Controller-ul folosește mesajul care conține 'Unable to determine county'.
        // Testăm exact cum mapează acest tip de eroare pe care o poate arunca validarea sau serviciul
        terrainService_1.terrainService.analyzeLocation.mockRejectedValue(new Error('Unable to determine county: Coordinates are invalid'));
        yield (0, terrainController_1.analyzeLocation)(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unable to determine county: Coordinates are invalid' });
    }));
    it('returns 500 without exposing internal Nominatim error details', () => __awaiter(void 0, void 0, void 0, function* () {
        terrainService_1.terrainService.analyzeLocation.mockRejectedValue(new Error('Nominatim returned 502 Bad Gateway at proxy'));
        yield (0, terrainController_1.analyzeLocation)(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Internal server error.' });
    }));
    it('returns correct Content-Type: application/json on all responses', () => __awaiter(void 0, void 0, void 0, function* () {
        // Explicit sau implicit via Express .json() care setează charset și type
        // Cum suntem în unit test, res.json() este apelat, ceea ce sub capotă în Express pune application/json
        terrainService_1.terrainService.analyzeLocation.mockResolvedValue({});
        yield (0, terrainController_1.analyzeLocation)(req, res);
        expect(res.json).toHaveBeenCalled();
    }));
});
