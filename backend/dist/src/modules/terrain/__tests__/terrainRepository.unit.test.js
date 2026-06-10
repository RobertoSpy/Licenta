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
const terrainRepository_1 = require("../terrainRepository");
const setup_1 = require("../../../../tests/setup");
describe('terrainRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('updateTerrainData', () => {
        it('updates project with terrain data', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.update.mockResolvedValue({ id: 1, soilType: 'Argila' });
            const res = yield terrainRepository_1.terrainRepository.updateTerrainData(1, { soilType: 'Argila' });
            expect(setup_1.prismaMock.project.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { soilType: 'Argila' }
            });
            expect(res).toEqual({ id: 1, soilType: 'Argila' });
        }));
    });
});
