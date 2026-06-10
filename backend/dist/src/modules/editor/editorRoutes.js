"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../core/middleware/tenantGuard");
const editorController_1 = require("./editorController");
const validateMiddleware_1 = require("../../core/middleware/validateMiddleware");
const router = (0, express_1.Router)();
// Toate rutele editorului necesită autentificare
router.use(authMiddleware_1.protect);
// Snapshots CRUD
router.post('/snapshots', (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.createSnapshotSchema), tenantGuard_1.tenantGuard, editorController_1.createSnapshot);
router.get('/snapshots/:projectId', tenantGuard_1.tenantGuard, editorController_1.listSnapshots);
router.get('/snapshots/single/:id', editorController_1.getSnapshot);
router.get('/latest/:projectId', tenantGuard_1.tenantGuard, editorController_1.getLatestSnapshot);
router.patch('/snapshots/:id/publish', tenantGuard_1.tenantGuard, editorController_1.publishSnapshot);
router.delete('/snapshots/:id', editorController_1.deleteSnapshot);
// AI Conformitate — SSE stream
router.post('/validate-conformity', (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.validateConformitySchema), editorController_1.validateConformity);
router.post('/explain-conformity', (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.explainConformitySchema), editorController_1.explainConformity);
// AI Autogenerare Layout
router.post('/generate-layout', tenantGuard_1.tenantGuard, editorController_1.generateLayout);
router.post('/generate-configurator-layout', tenantGuard_1.tenantGuard, editorController_1.generateConfiguratorLayout);
exports.default = router;
