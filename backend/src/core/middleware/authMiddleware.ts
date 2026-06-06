import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../../lib/prisma';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: UserRole;
  };
  project?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as { id: number };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true }
      });

      if (!user) {
        res.status(401).json({ message: 'Neautorizat, utilizatorul nu mai există' });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Neautorizat, token invalid' });
    }
  } else {
    res.status(401).json({ message: 'Neautorizat, nu există token în header' });
  }
};
