"use strict";
// backend/src/routes/exportRoutes.ts
//
// Endpoint-uri export:
//   GET /api/export/plan-pdf/:projectId  → PDF prezentare 2 pagini (Puppeteer)
//
// Nota PNG: exportul PNG se face direct din frontend (Konva Stage.toDataURL)
// fără backend — nicio rută necesară.
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../core/middleware/tenantGuard");
const exportController_1 = require("./exportController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.protect);
const methodNotAllowed = (req, res) => res.status(405).json({ message: 'Method Not Allowed' });
router.post('/plan-pdf/:projectId', tenantGuard_1.tenantGuard, exportController_1.exportController.generatePlanPdf);
router.all('/plan-pdf/:projectId', methodNotAllowed);
router.post('/contractor-pdf/:quoteId', exportController_1.exportController.generateContractorPdf);
router.all('/contractor-pdf/:quoteId', methodNotAllowed);
exports.default = router;
