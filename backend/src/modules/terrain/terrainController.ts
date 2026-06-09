import { Request, Response } from 'express';
import { terrainService } from './terrainService';

export const analyzeLocation = async (req: Request, res: Response) => {
  try {
    const result = await terrainService.analyzeLocation(req.body);
    return res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    if (error?.message && error.message.includes('Unable to determine county')) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    console.error('Error analyzing location:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};
