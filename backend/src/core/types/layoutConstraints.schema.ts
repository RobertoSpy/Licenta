import { z } from 'zod';

export const LayoutConstraintsSchema = z.object({
  minSurfaces: z.record(z.string(), z.number()),
  minWidths: z.record(z.string(), z.number()),
  maxAspectRatios: z.record(z.string(), z.number()).optional(),
  zoningRules: z.object({
    streetFacing: z.array(z.string()).optional(),
    backOnly: z.array(z.string()).optional(),
    mustHaveExteriorWall: z.array(z.string()).optional()
  }).optional(),
  generatedBy: z.literal('agent_legal_locuire'),
  normativeSources: z.array(z.string())
});

export type LayoutConstraints = z.infer<typeof LayoutConstraintsSchema>;
