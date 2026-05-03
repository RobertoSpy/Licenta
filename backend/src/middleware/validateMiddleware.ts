import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: z.ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
         res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.issues
        });
      } else {
        next(error);
      }
    }
  };
};

export const screen1Schema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  county: z.string().optional(),
}).refine(
  (data) => {
    if (data.lat != null && data.lng == null) return false;
    if (data.lng != null && data.lat == null) return false;
    return true;
  },
  { message: "Latitudinea și longitudinea trebuie introduse împreună sau deloc" }
);
