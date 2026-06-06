import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

import { UserRole } from '@prisma/client';

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== UserRole.ADMIN) {
    res.status(403).json({ message: 'Acces interzis. Această acțiune necesită permisiuni de administrator.' });
    return;
  }
  next();
};
