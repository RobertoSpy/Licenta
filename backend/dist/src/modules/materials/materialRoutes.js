"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const materialController_1 = require("./materialController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/materials — returneaza toate materialele
// protect: doar utilizatorii autentificați pot accesa lista de materiale
router.get('/', authMiddleware_1.protect, materialController_1.getAllMaterials);
router.get('/:internalCode/alternatives', authMiddleware_1.protect, materialController_1.getAlternatives);
exports.default = router;
