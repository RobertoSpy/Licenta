"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayoutConstraintsSchema = void 0;
const zod_1 = require("zod");
exports.LayoutConstraintsSchema = zod_1.z.object({
    minSurfaces: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    minWidths: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    maxAspectRatios: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    zoningRules: zod_1.z.object({
        streetFacing: zod_1.z.array(zod_1.z.string()).optional(),
        backOnly: zod_1.z.array(zod_1.z.string()).optional(),
        mustHaveExteriorWall: zod_1.z.array(zod_1.z.string()).optional()
    }).optional(),
    generatedBy: zod_1.z.literal('agent_legal_locuire'),
    normativeSources: zod_1.z.array(zod_1.z.string())
});
