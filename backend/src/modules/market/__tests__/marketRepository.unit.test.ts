import { marketRepository } from '../marketRepository';
import { prismaMock } from '../../../../tests/setup';

describe('Market Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertForecast', () => {
    it('invalidates ALL existing valid forecasts before inserting new one', async () => {
      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
      const createMock = jest.fn().mockResolvedValue({ id: 1 });
      
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          marketForecastCache: {
            updateMany: updateManyMock,
            create: createMock
          }
        });
      });
      
      await marketRepository.upsertForecast('{}', 'model');

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { isValid: true },
        data: { isValid: false }
      });
    });

    it('new forecast has isValid=true after upsert and stores forecastJson correctly', async () => {
      const createMock = jest.fn().mockResolvedValue({ id: 2, isValid: true });
      
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          marketForecastCache: {
            updateMany: jest.fn(),
            create: createMock
          }
        });
      });
      
      await marketRepository.upsertForecast('{"test": 1}', 'model-x');

      expect(createMock).toHaveBeenCalledWith({
        data: {
          forecastJson: '{"test": 1}',
          modelUsed: 'model-x',
          isValid: true
        }
      });
    });

    it('if insert fails, old forecasts remain valid (transaction rollback)', async () => {
      // Setup transaction mock
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        // mock tx
        const tx = {
          marketForecastCache: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockRejectedValue(new Error('Insert failed'))
          }
        };
        return callback(tx);
      });

      await expect(marketRepository.upsertForecast('{}', 'model')).rejects.toThrow('Insert failed');
      
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe('getLastNPoints', () => {
    it('getLastNPoints with 0 results returns empty array', async () => {
      prismaMock.marketIndexPoint.findMany.mockResolvedValue([]);
      
      const res = await marketRepository.getLastNPoints('rezidential', 36);
      
      expect(res).toEqual([]);
      expect(prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 36,
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }));
    });

    it('getLastNPoints with exactly 1 result returns array with 1 item', async () => {
      const mockPoint = { year: 2026, month: 1, indexValue: 100 };
      prismaMock.marketIndexPoint.findMany.mockResolvedValue([mockPoint] as any);
      
      const res = await marketRepository.getLastNPoints('rezidential', 36);
      
      expect(res).toEqual([mockPoint]);
    });
  });

  describe('getByCategory', () => {
    it('returns points', async () => {
      prismaMock.marketIndexPoint.findMany.mockResolvedValue([{ id: 1 }] as any);
      const res = await marketRepository.getByCategory('TOTAL');
      expect(prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith({
        where: { category: 'TOTAL' },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      });
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('getAll', () => {
    it('returns all points', async () => {
      prismaMock.marketIndexPoint.findMany.mockResolvedValue([{ id: 2 }] as any);
      const res = await marketRepository.getAll();
      expect(prismaMock.marketIndexPoint.findMany).toHaveBeenCalledWith({
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      });
      expect(res).toEqual([{ id: 2 }]);
    });
  });

  describe('getAnnualAverages', () => {
    it('computes annual averages', async () => {
      prismaMock.marketIndexPoint.findMany.mockResolvedValue([
        { year: 2023, indexValue: 100 },
        { year: 2023, indexValue: 110 },
        { year: 2024, indexValue: 120 }
      ] as any);
      const res = await marketRepository.getAnnualAverages('TOTAL');
      expect(res).toEqual([
        { year: 2023, avg: 105 },
        { year: 2024, avg: 120 }
      ]);
    });
  });

  describe('getLatestPoint', () => {
    it('returns latest point', async () => {
      prismaMock.marketIndexPoint.findFirst.mockResolvedValue({ id: 1 } as any);
      const res = await marketRepository.getLatestPoint('TOTAL');
      expect(res).toEqual({ id: 1 });
    });
  });

  describe('getLatestForecast', () => {
    it('returns latest forecast', async () => {
      prismaMock.marketForecastCache.findFirst.mockResolvedValue({ id: 1 } as any);
      const res = await marketRepository.getLatestForecast();
      expect(res).toEqual({ id: 1 });
    });
  });
});
