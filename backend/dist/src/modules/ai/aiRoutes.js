"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiController_1 = require("./aiController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../core/middleware/tenantGuard");
const validateMiddleware_1 = require("../../core/middleware/validateMiddleware");
const router = (0, express_1.Router)();
// POST /api/ai/chat — Chat RAG+CAG cu streaming SSE
// Nu are projectId propriu în params — contextul vine din body ca string pre-construit de frontend
router.post('/chat', authMiddleware_1.protect, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.chatSchema), aiController_1.aiController.chatStream);
// GET /api/ai/explain-material?base=x&alt=y  (legacy)
router.get('/explain-material', authMiddleware_1.protect, aiController_1.aiController.explainMaterial);
// POST /api/ai/explain-material  (full-context with projectId + material codes)
router.post('/explain-material', authMiddleware_1.protect, aiController_1.aiController.explainMaterial);
// GET /api/ai/explain-material/:materialId
router.get('/explain-material/:materialId', authMiddleware_1.protect, aiController_1.aiController.explainMaterialById);
// POST /api/ai/summarize — Rezumare conversație (non-streaming)
router.post('/summarize', authMiddleware_1.protect, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.summarizeConversationSchema), aiController_1.aiController.summarizeConversation);
// GET /api/ai/summary/:projectId?phase=...&screen=... — citire rezumat din DB
// tenantGuard extrage projectId din req.params.projectId
router.get('/summary/:projectId', authMiddleware_1.protect, tenantGuard_1.tenantGuard, aiController_1.aiController.getSummary);
// POST /api/ai/summary — salvare/actualizare rezumat în DB
// tenantGuard extrage projectId din req.body.projectId
router.post('/summary', authMiddleware_1.protect, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.saveSummarySchema), tenantGuard_1.tenantGuard, aiController_1.aiController.saveSummary);
// POST /api/ai/suggest-rooms — generare program funcțional AI (listă camere + weightRatio)
// tenantGuard extrage projectId din req.body.projectId
router.post('/suggest-rooms', authMiddleware_1.protect, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.suggestRoomsSchema), tenantGuard_1.tenantGuard, aiController_1.aiController.suggestRooms);
// POST /api/ai/validate-override — AI validează conformitatea normativă a unui material alternativ (SSE)
// Nu necesită tenantGuard — contextul proiectului vine în body ca string pre-construit
router.post('/validate-override', authMiddleware_1.protect, aiController_1.validateMaterialOverride);
exports.default = router;
