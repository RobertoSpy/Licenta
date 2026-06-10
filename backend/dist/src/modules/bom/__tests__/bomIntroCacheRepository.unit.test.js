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
const prisma_1 = require("../../../lib/prisma");
const bomIntroCacheRepository_1 = require("../bomIntroCacheRepository");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        bomIntroCache: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
describe('bomIntroCacheRepository', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('getByProject', () => {
        it('ar trebui sa returneze cache-ul pentru un proiect valid', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCache = { id: 1, projectId: 123, introText: 'Test intro' };
            prisma_1.prisma.bomIntroCache.findUnique.mockResolvedValue(mockCache);
            const result = yield bomIntroCacheRepository_1.bomIntroCacheRepository.getByProject(123);
            expect(prisma_1.prisma.bomIntroCache.findUnique).toHaveBeenCalledWith({ where: { projectId: 123 } });
            expect(result).toEqual(mockCache);
        }));
        it('ar trebui sa returneze null daca nu exista cache', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.bomIntroCache.findUnique.mockResolvedValue(null);
            const result = yield bomIntroCacheRepository_1.bomIntroCacheRepository.getByProject(999);
            expect(result).toBeNull();
        }));
    });
    describe('upsert', () => {
        it('ar trebui sa faca upsert la textul de intro', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCache = { id: 1, projectId: 123, introText: 'New intro text' };
            prisma_1.prisma.bomIntroCache.upsert.mockResolvedValue(mockCache);
            const result = yield bomIntroCacheRepository_1.bomIntroCacheRepository.upsert(123, 'New intro text');
            expect(prisma_1.prisma.bomIntroCache.upsert).toHaveBeenCalledWith({
                where: { projectId: 123 },
                update: { introText: 'New intro text' },
                create: { projectId: 123, introText: 'New intro text' },
            });
            expect(result).toEqual(mockCache);
        }));
    });
});
