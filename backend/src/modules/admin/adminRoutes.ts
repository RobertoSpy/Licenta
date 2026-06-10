import { Router } from 'express';
import multer from 'multer';
import { 
  syncDedemanMaterials, 
  addMaterialFromUrl,
  addMaterialManual,
  importMaterialsCsv,
  getUsers,
  getAllMaterials,
  updateMaterial,
  deleteMaterial,
  reseedNormatives,
  toggleContractorVerification
} from './adminController';
import { protect } from '../../core/middleware/authMiddleware';
import { requireAdmin } from '../../core/middleware/requireAdmin';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Toate rutele de aici necesită autentificare
router.use(protect);

// Rute accesibile pentru orice utilizator logat
router.post('/scrape/add', addMaterialFromUrl);

// Toate rutele de aici în jos necesită rol de admin
router.use(requireAdmin);

router.get('/users', getUsers);
router.patch('/users/:id/verify-contractor', toggleContractorVerification);
router.get('/materials', getAllMaterials);
router.post('/materials/manual', addMaterialManual);
router.post('/materials/import-csv', upload.single('csvFile'), importMaterialsCsv);
router.put('/materials/:id', updateMaterial);
router.delete('/materials/:id', deleteMaterial);
router.post('/scrape/sync', syncDedemanMaterials);

router.post('/normatives/reseed', reseedNormatives);

export default router;
