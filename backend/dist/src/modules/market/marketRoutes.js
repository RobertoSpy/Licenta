"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const marketController_1 = require("./marketController");
const router = (0, express_1.Router)();
// Toate rutele de market necesită autentificare
router.use(authMiddleware_1.protect);
// Rute Date Piață (Market Intelligence)
router.get('/history', marketController_1.getHistory);
router.get('/forecast', marketController_1.getForecast);
router.get('/summary', marketController_1.getSummary);
// Rute Client
router.post('/projects/:id/publish', marketController_1.publishProject);
router.get('/projects/:id/quotes', marketController_1.getProjectQuotes);
router.post('/quotes/:quoteId/accept', marketController_1.acceptQuote);
router.post('/quotes/:quoteId/reject', marketController_1.rejectQuote);
// Rute Constructor
router.get('/projects/feed', marketController_1.getFeed);
router.post('/projects/:id/quotes', marketController_1.submitQuote);
exports.default = router;
