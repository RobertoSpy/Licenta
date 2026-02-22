import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
  };
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as { id: number };
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Neautorizat, token invalid' });
    }
  } else {
    res.status(401).json({ message: 'Neautorizat, nu există token în header' });
  }
};
