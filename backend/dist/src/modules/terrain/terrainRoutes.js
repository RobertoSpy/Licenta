"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const terrainController_1 = require("./terrainController");
const validateMiddleware_1 = require("../../core/middleware/validateMiddleware");
const router = (0, express_1.Router)();
// Screen 1: GPS -> automatic data
router.post('/analyze-location', (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.screen1Schema), terrainController_1.analyzeLocation);
exports.default = router;
