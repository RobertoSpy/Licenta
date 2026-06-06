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

// ==========================================
// SCHEME PENTRU AUTH
// ==========================================
export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
}).strip();

export const registerContractorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  cui: z.string().min(5),
  county: z.string().min(2),
  specializations: z.array(z.string()).min(1),
  coverageRadius: z.number().min(5).max(1000).optional(),
}).strip();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
}).strip();

export const emailOnlySchema = z.object({
  email: z.string().email(),
}).strip();

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6),
  newPassword: z.string().min(8),
}).strip();

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6),
}).strip();

// ==========================================
// SCHEME PENTRU AI
// ==========================================
export const chatSchema = z.object({
  message: z.string().min(1),
  contextString: z.string().optional(),
  conversationHistory: z.array(z.any()).optional(),
  screenContext: z.any().optional(),
  historySummary: z.string().nullable().optional(),
}).strip();

export const summarizeConversationSchema = z.object({
  systemPrompt: z.string().optional(),
  text: z.string().min(1),
}).strip();

export const saveSummarySchema = z.object({
  projectId: z.union([z.string(), z.number()]),
  phase: z.string().min(1),
  screen: z.string().nullable().optional(),
  summary: z.string().min(1),
}).strip();

export const suggestRoomsSchema = z.object({
  projectId: z.union([z.string(), z.number()]),
  familySize: z.number().min(1).max(20),
  budgetCategory: z.enum(['economic', 'mediu']),
  houseAreaSqm: z.number().min(10),
  totalFloors: z.number().min(1).optional().default(1),
  projectData: z.any().optional(),
  screenContext: z.any().optional(),
}).strip();

// ==========================================
// SCHEME PENTRU EDITOR / PROIECT
// ==========================================
export const createSnapshotSchema = z.object({
  projectId: z.union([z.string(), z.number()]),
  floor: z.string(),
  planJSON: z.object({
    elements: z.array(z.any()),
    savedAt: z.number().optional()
  }),
  label: z.string().optional(),
  isManual: z.boolean().optional(),
}).strip();

export const validateConformitySchema = z.object({
  rooms: z.array(z.any()),
  doors: z.array(z.any()).optional(),
  buildingPurpose: z.string().optional(),
}).strip();

export const explainConformitySchema = z.object({
  ruleId: z.string(),
  itemContext: z.any(),
}).strip();

export const screen1Schema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  county: z.string().optional(),
}).strip().refine(
  (data) => {
    if (data.lat != null && data.lng == null) return false;
    if (data.lng != null && data.lat == null) return false;
    return true;
  },
  { message: "Latitudinea și longitudinea trebuie introduse împreună sau deloc" }
);
