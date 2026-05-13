import { Router } from 'express';
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject
} from '../controllers/projectController';
import { protect } from '../middleware/authMiddleware';
import { tenantGuard } from '../middleware/tenantGuard';

const router = Router();

// Toate rutele necesită autentificare
router.use(protect);

// Rute fără projectId — fără tenantGuard
router.route('/')
  .post(createProject)
  .get(getUserProjects);

// Rute cu projectId — tenantGuard verifică ownership înainte de controller
router.route('/:id')
  .get(tenantGuard, getProjectById)
  .patch(tenantGuard, updateProject)
  .delete(tenantGuard, deleteProject);

export default router;
