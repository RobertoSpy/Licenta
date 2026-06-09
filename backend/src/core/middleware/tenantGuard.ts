import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { projectRepository } from '../../modules/project/projectRepository';

/**
 * Middleware de izolare tenant (Row-Level Security la nivel de aplicație).
 *
 * Verifică că proiectul din request (params sau body) aparține
 * utilizatorului autentificat curent. Dacă verificarea trece,
 * atașează proiectul la req.project pentru a evita un query duplicat
 * în controller sau service.
 *
 * Utilizare:
 *  - router.get('/:id', protect, tenantGuard, controller)
 *  - router.post('/summary', protect, tenantGuard, controller)
 *
 * Extrage projectId din (în ordine): req.params.id, req.params.projectId, req.body.projectId
 */
export const tenantGuard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const rawId = req.params.id ?? req.params.projectId ?? req.body?.projectId;
  const projectId = parseInt(rawId as string);

  if (isNaN(projectId)) {
    res.status(400).json({ message: 'ID proiect invalid sau lipsă.' });
    return;
  }

  const project = await projectRepository.findById(projectId);

  if (!project) {
    res.status(404).json({ message: 'Proiect negăsit.' });
    return;
  }

  if (project.userId !== req.user?.id) {
    // Excepție: Constructorii pot accesa proiectele (ex: pentru PDF-uri) dacă acestea sunt publicate pe marketplace
    if (req.user?.role === 'CONTRACTOR' && (project as any).isPublishedForBidding) {
      // Permite accesul
    } else {
      res.status(403).json({ message: 'Acces interzis.' });
      return;
    }
  }

  // Atașăm proiectul verificat la request — controllere aval nu mai fac query duplicat
  req.project = project;
  next();
};
