import { Router } from 'express';
import { syncDedemanMaterials, addMaterialFromUrl } from '../controllers/adminController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Endpoint-uri rezervate pentru administrator
// (În mod ideal ai adăuga și un middleware `authorize('ADMIN')` aici, 
// dar pentru demonstrația de licență folosim `protect` simplu).

router.post('/scrape/sync', protect, syncDedemanMaterials);
router.post('/scrape/add', protect, addMaterialFromUrl);

export default router;
