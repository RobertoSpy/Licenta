import { Router } from 'express';
import { getAllMaterials } from '../controllers/materialController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// GET /api/materials — returneaza toate materialele
// protect: doar utilizatorii autentificați pot accesa lista de materiale
router.get('/', protect, getAllMaterials);

export default router;
