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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const normativeCache_1 = require("../services/normativeCache");
jest.mock('fs');
jest.mock('path', () => {
    const actualPath = jest.requireActual('path');
    return Object.assign(Object.assign({}, actualPath), { join: jest.fn((...args) => args.join('/')) // simplified mock
     });
});
describe('normativeCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        normativeCache_1.normativeCache.clear();
    });
    it('ar trebui sa incarce datele din fisiere si sa le puna in cache la primul apel', () => __awaiter(void 0, void 0, void 0, function* () {
        fs_1.default.readFileSync.mockImplementation((filepath) => {
            if (filepath.includes('seismic-zones.json'))
                return '{"seismic": true}';
            if (filepath.includes('frost-depth.json'))
                return '{"frost": true}';
            if (filepath.includes('floor-rules.json'))
                return '{"floors": true}';
            if (filepath.includes('snow-zones.json'))
                return '{"snow": true}';
            if (filepath.includes('wind-zones.json'))
                return '{"wind": true}';
            return '{}';
        });
        const result = yield normativeCache_1.normativeCache.load();
        expect(fs_1.default.readFileSync).toHaveBeenCalledTimes(5);
        expect(result).toContain('=== NORMATIVE STATICE CAG');
        expect(result).toContain('{"seismic": true}');
        expect(result).toContain('{"frost": true}');
        expect(result).toContain('{"floors": true}');
        expect(result).toContain('{"snow": true}');
        expect(result).toContain('{"wind": true}');
    }));
    it('ar trebui sa returneze valoarea din cache la apeluri ulterioare fara a mai citi din FS', () => __awaiter(void 0, void 0, void 0, function* () {
        fs_1.default.readFileSync.mockReturnValue('mock-data');
        const result1 = yield normativeCache_1.normativeCache.load();
        expect(fs_1.default.readFileSync).toHaveBeenCalledTimes(5);
        const result2 = yield normativeCache_1.normativeCache.load();
        expect(fs_1.default.readFileSync).toHaveBeenCalledTimes(5); // Ramane 5, nu creste
        expect(result1).toBe(result2);
    }));
    it('ar trebui sa returneze un string gol si sa logheze eroare daca FS da fail', () => __awaiter(void 0, void 0, void 0, function* () {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        fs_1.default.readFileSync.mockImplementation(() => {
            throw new Error('File not found');
        });
        const result = yield normativeCache_1.normativeCache.load();
        expect(result).toBe('');
        expect(consoleSpy).toHaveBeenCalledWith('[normativeCache] Eroare la încărcare CAG:', 'File not found');
        consoleSpy.mockRestore();
    }));
    it('ar trebui sa stearga cache-ul cand este apelata functia clear()', () => __awaiter(void 0, void 0, void 0, function* () {
        fs_1.default.readFileSync.mockReturnValue('mock-data');
        yield normativeCache_1.normativeCache.load();
        expect(fs_1.default.readFileSync).toHaveBeenCalledTimes(5);
        normativeCache_1.normativeCache.clear();
        yield normativeCache_1.normativeCache.load();
        expect(fs_1.default.readFileSync).toHaveBeenCalledTimes(10); // A citit din nou
    }));
});
