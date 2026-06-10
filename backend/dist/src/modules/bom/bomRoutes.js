"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bomController_1 = require("./bomController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../core/middleware/tenantGuard");
const router = (0, express_1.Router)();
// Toate rutele de BOM necesită autentificare și ownership pe proiect
router.use(authMiddleware_1.protect);
router.use('/:projectId', tenantGuard_1.tenantGuard);
router.post('/:projectId/generate', bomController_1.generateBOM);
router.patch('/:projectId/material', bomController_1.updateMaterialOverride);
router.get('/:projectId/intro', bomController_1.getBOMIntro);
router.get('/:projectId/phase-state', bomController_1.getBOMPhaseState);
router.post('/:projectId/phase-state/confirm', bomController_1.confirmBOMPhase);
// POST /api/bom/:projectId/chat — Asistentul RAG conversațional pentru deviz (SSE)
router.post('/:projectId/chat', bomController_1.bomAdvisorChat);
// Export PDF
router.get('/:projectId/export-pdf', bomController_1.exportPdf);
exports.default = router;
