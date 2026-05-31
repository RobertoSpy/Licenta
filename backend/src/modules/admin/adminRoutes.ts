import { Router } from 'express';
import { 
  syncDedemanMaterials, 
  addMaterialFromUrl,
  getUsers,
  getAllMaterials,
  updateMaterial,
  deleteMaterial,
  reseedNormatives
} from './adminController';
import { protect } from '../../core/middleware/authMiddleware';
import { requireAdmin } from '../../core/middleware/requireAdmin';

const router = Router();

// Toate rutele de aici necesită autentificare
router.use(protect);

// Rute accesibile pentru orice utilizator logat
router.post('/scrape/add', addMaterialFromUrl);

// Toate rutele de aici în jos necesită rol de admin
router.use(requireAdmin);

router.get('/users', getUsers);
router.get('/materials', getAllMaterials);
router.put('/materials/:id', updateMaterial);
router.delete('/materials/:id', deleteMaterial);
router.post('/scrape/sync', syncDedemanMaterials);

router.post('/normatives/reseed', reseedNormatives);

export default router;
