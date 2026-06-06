import { Router } from 'express';
import { protect, AuthRequest } from '../../core/middleware/authMiddleware';
import { requireRole } from '../../core/middleware/roleMiddleware';
import { getContractors, getContractorById, getMyProfile, updateMyProfile, addReview, getAcceptedProjects } from './contractorController';

// UserRole importat din prisma după generate
const UserRole = { CLIENT: 'CLIENT', CONTRACTOR: 'CONTRACTOR', ADMIN: 'ADMIN' } as const;

const router = Router();

// Rute publice (oricine logat)
router.get('/', protect, getContractors);

// IMPORTANT: /me/* trebuie să fie înainte de /:id ca să nu fie prins de params
router.get('/me/profile', protect, requireRole(UserRole.CONTRACTOR as any), getMyProfile);
router.put('/me/profile', protect, requireRole(UserRole.CONTRACTOR as any), updateMyProfile);
router.get('/me/accepted-projects', protect, requireRole(UserRole.CONTRACTOR as any), getAcceptedProjects);

// Rute cu param
router.get('/:id', protect, getContractorById);
router.post('/:id/reviews', protect, requireRole(UserRole.CLIENT as any), addReview);

export default router;
