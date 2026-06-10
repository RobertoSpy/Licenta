"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const projectController_1 = require("./projectController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../core/middleware/tenantGuard");
const router = (0, express_1.Router)();
// Toate rutele necesită autentificare
router.use(authMiddleware_1.protect);
// Rute fără projectId — fără tenantGuard
router.route('/')
    .post(projectController_1.createProject)
    .get(projectController_1.getUserProjects);
// Rute cu projectId — tenantGuard verifică ownership înainte de controller
router.route('/:id')
    .get(tenantGuard_1.tenantGuard, projectController_1.getProjectById)
    .patch(tenantGuard_1.tenantGuard, projectController_1.updateProject)
    .delete(tenantGuard_1.tenantGuard, projectController_1.deleteProject);
exports.default = router;
