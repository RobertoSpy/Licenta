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
const materialController_1 = require("../materialController");
const materialRepository_1 = require("../materialRepository");
jest.mock('../materialRepository');
describe('Material Controller', () => {
    let req;
    let res;
    let jsonMock;
    let statusMock;
    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        req = {
            params: {},
        };
        res = {
            json: jsonMock,
            status: statusMock,
        };
        jest.clearAllMocks();
    });
    describe('getAllMaterials', () => {
        it('returns 200 and maps materials adding price field', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterials = [
                { id: 1, internalCode: 'MAT-1', pricePerUnit: 100 },
                { id: 2, internalCode: 'MAT-2', pricePerUnit: 200 },
            ];
            materialRepository_1.materialRepository.findAll.mockResolvedValue(mockMaterials);
            yield (0, materialController_1.getAllMaterials)(req, res);
            expect(jsonMock).toHaveBeenCalledWith([
                { id: 1, internalCode: 'MAT-1', pricePerUnit: 100, price: 100 },
                { id: 2, internalCode: 'MAT-2', pricePerUnit: 200, price: 200 },
            ]);
        }));
        it('returns 500 without exposing internal error details when repository throws', () => __awaiter(void 0, void 0, void 0, function* () {
            materialRepository_1.materialRepository.findAll.mockRejectedValue(new Error('DB Error'));
            yield (0, materialController_1.getAllMaterials)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Eroare la preluarea materialelor' });
        }));
    });
    describe('getAlternatives', () => {
        it('returns 404 when material is not found', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { internalCode: 'UNKNOWN' };
            materialRepository_1.materialRepository.findByInternalCodeWithAlternatives.mockResolvedValue(null);
            yield (0, materialController_1.getAlternatives)(req, res);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Materialul de bază nu a fost găsit' });
        }));
        it('returns alternatives array when material is found', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { internalCode: 'MAT-1' };
            const mockMaterial = {
                id: 1,
                alternatives: [{ id: 2, internalCode: 'MAT-2' }],
            };
            materialRepository_1.materialRepository.findByInternalCodeWithAlternatives.mockResolvedValue(mockMaterial);
            yield (0, materialController_1.getAlternatives)(req, res);
            expect(jsonMock).toHaveBeenCalledWith([{ id: 2, internalCode: 'MAT-2' }]);
        }));
        it('returns empty array when material has no alternatives', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { internalCode: 'MAT-1' };
            const mockMaterial = {
                id: 1,
                alternatives: null, // Testăm fallback-ul la [] în controller
            };
            materialRepository_1.materialRepository.findByInternalCodeWithAlternatives.mockResolvedValue(mockMaterial);
            yield (0, materialController_1.getAlternatives)(req, res);
            expect(jsonMock).toHaveBeenCalledWith([]);
        }));
        it('returns 500 without exposing internal error details when repository throws', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { internalCode: 'MAT-1' };
            materialRepository_1.materialRepository.findByInternalCodeWithAlternatives.mockRejectedValue(new Error('DB Error'));
            yield (0, materialController_1.getAlternatives)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Eroare la preluarea alternativelor' });
        }));
    });
});
