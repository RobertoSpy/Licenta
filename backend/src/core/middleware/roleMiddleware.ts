import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { UserRole } from '@prisma/client';

/**
 * Middleware pentru restricționarea accesului bazat pe rol.
 * Trebuie folosit DUPĂ middleware-ul `protect`.
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
       res.status(401).json({ message: 'Neautorizat, utilizator inexistent în request' });
       return;
    }

    if (!roles.includes(req.user.role)) {
       res.status(403).json({ message: `Acces interzis pentru rolul: ${req.user.role}. Necesită: ${roles.join(', ')}` });
       return;
    }

    next();
  };
};
