"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const roleMiddleware_1 = require("../../core/middleware/roleMiddleware");
const contractorController_1 = require("./contractorController");
// UserRole importat din prisma după generate
const UserRole = { CLIENT: 'CLIENT', CONTRACTOR: 'CONTRACTOR', ADMIN: 'ADMIN' };
const router = (0, express_1.Router)();
// Rute publice (oricine logat)
router.get('/', authMiddleware_1.protect, contractorController_1.getContractors);
// IMPORTANT: /me/* trebuie să fie înainte de /:id ca să nu fie prins de params
router.get('/me/profile', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(UserRole.CONTRACTOR), contractorController_1.getMyProfile);
router.put('/me/profile', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(UserRole.CONTRACTOR), contractorController_1.updateMyProfile);
router.get('/me/accepted-projects', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(UserRole.CONTRACTOR), contractorController_1.getAcceptedProjects);
// Rute cu param
router.get('/:id', authMiddleware_1.protect, contractorController_1.getContractorById);
router.post('/:id/reviews', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(UserRole.CLIENT), contractorController_1.addReview);
exports.default = router;
