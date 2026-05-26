import { Router } from 'express';
import { getAllMaterials, getAlternatives } from '../controllers/materialController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// GET /api/materials — returneaza toate materialele
// protect: doar utilizatorii autentificați pot accesa lista de materiale
router.get('/', protect, getAllMaterials);
router.get('/:internalCode/alternatives', protect, getAlternatives);

export default router;
