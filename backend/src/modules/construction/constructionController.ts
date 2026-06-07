import { Request, Response } from 'express';
import { constructionService } from './constructionService';
import { AuthRequest } from '../../core/middleware/authMiddleware';

export const getPhases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    if (!req.project?.publishedSnapshotId) {
      res.status(400).json({ error: 'Proiectul nu are un plan publicat' });
      return;
    }

    const phases = await constructionService.getProjectPhases(projectId);
    res.json(phases);
  } catch (error: any) {
    if (error.message === 'MISSING_JSON_FILE' || error.message === 'MALFORMED_JSON_FILE') {
      res.status(500).json({ error: 'Eroare la configuratia fazelor' });
      return;
    }
    console.error('[ConstructionController] Eroare la preluare etape:', error);
    res.status(500).json({ error: 'Eroare la preluare etape' });
  }
};

export const completePhase = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    const phaseOrder = parseInt(req.params.phaseOrder as string, 10);
    
    if (isNaN(projectId) || isNaN(phaseOrder) || phaseOrder < 1) {
      res.status(400).json({ error: 'Parametri invalizi' });
      return;
    }

    const updated = await constructionService.completePhase(projectId, phaseOrder);
    res.json(updated);
  } catch (error: any) {
    if (error.message === 'PHASE_NOT_FOUND') {
      res.status(404).json({ error: 'Faza nu exista' });
      return;
    }
    if (error.message === 'PREREQUISITE_NOT_COMPLETED') {
      res.status(409).json({ error: 'Faza anterioara nu este completata' });
      return;
    }
    console.error('[ConstructionController] Eroare la completare etapa:', error);
    res.status(500).json({ error: 'Eroare la completare etapa' });
  }
};
