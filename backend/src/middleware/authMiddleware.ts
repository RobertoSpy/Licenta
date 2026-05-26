import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
  };
  project?: any;
}
//next este o functie care trimite cerea  mai departe la urmatorul pas din cod daca este totul bine
export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token;
//verifica daca headerul are autorization si daca incepe cu bearer tokenul
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
