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
const marketRepository_1 = require("../marketRepository");
const setup_1 = require("../../../../tests/setup");
describe('Market Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('upsertForecast', () => {
        it('invalidates ALL existing valid forecasts before inserting new one', () => __awaiter(void 0, void 0, void 0, function* () {
            const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
            const createMock = jest.fn().mockResolvedValue({ id: 1 });
            setup_1.prismaMock.$transaction.mockImplementation((callback) => __awaiter(void 0, void 0, void 0, function* () {
                return callback({
                    marketForecastCache: {
                        updateMany: updateManyMock,
                        create: createMock
                    }
                });
            }));
            yield marketRepository_1.marketRepository.upsertForecast('{}', 'model');
            expect(updateManyMock).toHaveBeenCalledWith({
                where: { isValid: true },
                data: { isValid: false }
            });
        }));
        it('new forecast has isValid=true after upsert and stores forecastJson correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const createMock = jest.fn().mockResolvedValue({ id: 2, isValid: true });
            setup_1.prismaMock.$transaction.mockImplementation((callback) => __awaiter(void 0, void 0, void 0, function* () {
                return callback({
                    marketForecastCache: {
                        updateMany: jest.fn(),
                        create: createMock
                    }
                });
            }));
            yield marketRepository_1.marketRepository.upsertForecast('{"test": 1}', 'model-x');
            expect(createMock).toHaveBeenCalledWith({
                data: {
                    forecastJson: '{"test": 1}',
                    modelUsed: 'model-x',
                    isValid: true
                }
            });
        }));
        it('if insert fails, old forecasts remain valid (transaction rollback)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Setup transaction mock
            setup_1.prismaMock.$transaction.mockImplementation((callback) => __awaiter(void 0, void 0, void 0, function* () {
                // mock tx
                const tx = {
                    marketForecastCache: {
                        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                        create: jest.fn().mockRejectedValue(new Error('Insert failed'))
                    }
                };
                return callback(tx);
            }));
            yield expect(marketRepository_1.marketRepository.upsertForecast('{}', 'model')).rejects.toThrow('Insert failed');
            expect(setup_1.prismaMock.$transaction).toHaveBeenCalled();
        }));
    });
    describe('getLastNPoints', () => {
        it('getLastNPoints with 0 results returns empty array', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([]);
            const res = yield marketRepository_1.marketRepository.getLastNPoints('rezidential', 36);
            expect(res).toEqual([]);
            expect(setup_1.prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith(expect.objectContaining({
                take: 36,
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            }));
        }));
        it('getLastNPoints with exactly 1 result returns array with 1 item', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPoint = { year: 2026, month: 1, indexValue: 100 };
            setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([mockPoint]);
            const res = yield marketRepository_1.marketRepository.getLastNPoints('rezidential', 36);
            expect(res).toEqual([mockPoint]);
        }));
    });
    describe('getByCategory', () => {
        it('returns points', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([{ id: 1 }]);
            const res = yield marketRepository_1.marketRepository.getByCategory('TOTAL');
            expect(setup_1.prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith({
                where: { category: 'TOTAL' },
                orderBy: [{ year: 'asc' }, { month: 'asc' }]
            });
            expect(res).toEqual([{ id: 1 }]);
        }));
    });
    describe('getAll', () => {
        it('returns all points', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([{ id: 2 }]);
            const res = yield marketRepository_1.marketRepository.getAll();
            expect(setup_1.prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith({
                orderBy: [{ year: 'asc' }, { month: 'asc' }]
            });
            expect(res).toEqual([{ id: 2 }]);
        }));
    });
    describe('getAnnualAverages', () => {
        it('computes annual averages', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([
                { year: 2023, indexValue: 100 },
                { year: 2023, indexValue: 110 },
                { year: 2024, indexValue: 120 }
            ]);
            const res = yield marketRepository_1.marketRepository.getAnnualAverages('TOTAL');
            expect(res).toEqual([
                { year: 2023, avg: 105 },
                { year: 2024, avg: 120 }
            ]);
        }));
    });
    describe('getLatestPoint', () => {
        it('returns latest point', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketIndexPoint.findFirst.mockResolvedValue({ id: 1 });
            const res = yield marketRepository_1.marketRepository.getLatestPoint('TOTAL');
            expect(res).toEqual({ id: 1 });
        }));
    });
    describe('getLatestForecast', () => {
        it('returns latest forecast', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.marketForecastCache.findFirst.mockResolvedValue({ id: 1 });
            const res = yield marketRepository_1.marketRepository.getLatestForecast();
            expect(res).toEqual({ id: 1 });
        }));
    });
});
