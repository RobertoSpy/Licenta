import { Router } from 'express';
import { createProject, getUserProjects, getProjectById } from '../controllers/projectController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect); // Toate rutele de mai jos necesită autentificare

router.route('/')
  .post(createProject)
  .get(getUserProjects);

router.route('/:id')
  .get(getProjectById);

export default router;
