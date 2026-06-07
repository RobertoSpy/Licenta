import { Request, Response } from 'express';
import { getAllMaterials, getAlternatives } from '../materialController';
import { materialRepository } from '../materialRepository';

jest.mock('../materialRepository');

describe('Material Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

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
    it('returns 200 and maps materials adding price field', async () => {
      const mockMaterials = [
        { id: 1, internalCode: 'MAT-1', pricePerUnit: 100 },
        { id: 2, internalCode: 'MAT-2', pricePerUnit: 200 },
      ] as any;
      (materialRepository.findAll as jest.Mock).mockResolvedValue(mockMaterials);

      await getAllMaterials(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith([
        { id: 1, internalCode: 'MAT-1', pricePerUnit: 100, price: 100 },
        { id: 2, internalCode: 'MAT-2', pricePerUnit: 200, price: 200 },
      ]);
    });

    it('returns 500 without exposing internal error details when repository throws', async () => {
      (materialRepository.findAll as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await getAllMaterials(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Eroare la preluarea materialelor' });
    });
  });

  describe('getAlternatives', () => {
    it('returns 404 when material is not found', async () => {
      req.params = { internalCode: 'UNKNOWN' };
      (materialRepository.findByInternalCodeWithAlternatives as jest.Mock).mockResolvedValue(null);

      await getAlternatives(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Materialul de bază nu a fost găsit' });
    });

    it('returns alternatives array when material is found', async () => {
      req.params = { internalCode: 'MAT-1' };
      const mockMaterial = {
        id: 1,
        alternatives: [{ id: 2, internalCode: 'MAT-2' }],
      };
      (materialRepository.findByInternalCodeWithAlternatives as jest.Mock).mockResolvedValue(mockMaterial);

      await getAlternatives(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith([{ id: 2, internalCode: 'MAT-2' }]);
    });

    it('returns empty array when material has no alternatives', async () => {
      req.params = { internalCode: 'MAT-1' };
      const mockMaterial = {
        id: 1,
        alternatives: null, // Testăm fallback-ul la [] în controller
      };
      (materialRepository.findByInternalCodeWithAlternatives as jest.Mock).mockResolvedValue(mockMaterial);

      await getAlternatives(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('returns 500 without exposing internal error details when repository throws', async () => {
      req.params = { internalCode: 'MAT-1' };
      (materialRepository.findByInternalCodeWithAlternatives as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await getAlternatives(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Eroare la preluarea alternativelor' });
    });
  });
});
