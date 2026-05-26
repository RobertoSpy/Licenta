import { Request, Response } from 'express';
import { constructionService } from '../services/constructionService';

export const getPhases = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const phases = await constructionService.getProjectPhases(projectId);
    res.json(phases);
  } catch (error: any) {
    console.error('[ConstructionController] Eroare la preluare etape:', error);
    res.status(500).json({ error: 'Eroare la preluare etape' });
  }
};

export const completePhase = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    const phaseOrder = parseInt(req.params.phaseOrder as string, 10);
    
    if (isNaN(projectId) || isNaN(phaseOrder)) {
      res.status(400).json({ error: 'Parametri invalizi' });
      return;
    }

    const updated = await constructionService.completePhase(projectId, phaseOrder);
    res.json(updated);
  } catch (error: any) {
    console.error('[ConstructionController] Eroare la completare etapă:', error);
    res.status(500).json({ error: 'Eroare la completare etapă' });
  }
};
