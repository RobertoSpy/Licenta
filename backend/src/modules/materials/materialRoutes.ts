import { Router } from 'express';
import { getAllMaterials, getAlternatives, getTaxonomy } from './materialController';
import { protect } from '../../core/middleware/authMiddleware';

const router = Router();

// GET /api/materials — returneaza toate materialele
// protect: doar utilizatorii autentificați pot accesa lista de materiale
router.get('/', protect, getAllMaterials);
router.get('/taxonomy', protect, getTaxonomy);
router.get('/:internalCode/alternatives', protect, getAlternatives);

export default router;
