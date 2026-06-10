"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screen1Schema = exports.explainConformitySchema = exports.validateConformitySchema = exports.createSnapshotSchema = exports.suggestRoomsSchema = exports.saveSummarySchema = exports.summarizeConversationSchema = exports.chatSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.emailOnlySchema = exports.loginSchema = exports.registerContractorSchema = exports.registerSchema = exports.validateRequest = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const validateRequest = (schema) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: error.issues
                });
            }
            else {
                next(error);
            }
        }
    });
};
exports.validateRequest = validateRequest;
// ==========================================
// SCHEME PENTRU AUTH
// ==========================================
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
}).strip();
exports.registerContractorSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    companyName: zod_1.z.string().min(2),
    cui: zod_1.z.string().min(5),
    county: zod_1.z.string().min(2),
    specializations: zod_1.z.array(zod_1.z.nativeEnum(client_1.ContractorSpecialization)).min(1),
    coverageRadius: zod_1.z.number().min(5).max(1000).optional(),
}).strip();
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
}).strip();
exports.emailOnlySchema = zod_1.z.object({
    email: zod_1.z.string().email(),
}).strip();
exports.resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    otp: zod_1.z.string().min(6),
    newPassword: zod_1.z.string().min(8),
}).strip();
exports.verifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    otp: zod_1.z.string().min(6),
}).strip();
// ==========================================
// SCHEME PENTRU AI
// ==========================================
exports.chatSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    contextString: zod_1.z.string().optional(),
    conversationHistory: zod_1.z.array(zod_1.z.any()).optional(),
    screenContext: zod_1.z.any().optional(),
    historySummary: zod_1.z.string().nullable().optional(),
}).strip();
exports.summarizeConversationSchema = zod_1.z.object({
    systemPrompt: zod_1.z.string().optional(),
    text: zod_1.z.string().min(1),
}).strip();
exports.saveSummarySchema = zod_1.z.object({
    projectId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    phase: zod_1.z.string().min(1),
    screen: zod_1.z.string().nullable().optional(),
    summary: zod_1.z.string().min(1),
}).strip();
exports.suggestRoomsSchema = zod_1.z.object({
    projectId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    familySize: zod_1.z.number().min(1).max(20),
    budgetCategory: zod_1.z.enum(['economic', 'mediu']),
    houseAreaSqm: zod_1.z.number().min(10),
    totalFloors: zod_1.z.number().min(1).optional().default(1),
    projectData: zod_1.z.any().optional(),
    screenContext: zod_1.z.any().optional(),
}).strip();
// ==========================================
// SCHEME PENTRU EDITOR / PROIECT
// ==========================================
exports.createSnapshotSchema = zod_1.z.object({
    projectId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    floor: zod_1.z.string(),
    planJSON: zod_1.z.object({
        elements: zod_1.z.array(zod_1.z.any()),
        savedAt: zod_1.z.number().optional()
    }),
    label: zod_1.z.string().optional(),
    isManual: zod_1.z.boolean().optional(),
}).strip();
exports.validateConformitySchema = zod_1.z.object({
    rooms: zod_1.z.array(zod_1.z.any()),
    doors: zod_1.z.array(zod_1.z.any()).optional(),
    buildingPurpose: zod_1.z.string().optional(),
}).strip();
exports.explainConformitySchema = zod_1.z.object({
    violations: zod_1.z.array(zod_1.z.object({
        label: zod_1.z.string(),
        usableSqm: zod_1.z.number().min(0),
        minRequired: zod_1.z.number().min(0),
    })).min(1, 'At least one violation required'),
}).strip();
exports.screen1Schema = zod_1.z.object({
    lat: zod_1.z.number().min(-90).max(90).nullable().optional(),
    lng: zod_1.z.number().min(-180).max(180).nullable().optional(),
    county: zod_1.z.string().optional(),
}).strip().refine((data) => {
    if (data.lat != null && data.lng == null)
        return false;
    if (data.lng != null && data.lat == null)
        return false;
    return true;
}, { message: "Latitudinea și longitudinea trebuie introduse împreună sau deloc" });
