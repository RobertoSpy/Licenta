import { Router } from 'express';
import { createProject, getUserProjects, getProjectById, updateProject, deleteProject } from '../controllers/projectController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect); // Toate rutele de mai jos necesită autentificare

router.route('/')
  .post(createProject)
  .get(getUserProjects);

router.route('/:id')
  .get(getProjectById)
  .patch(updateProject)
  .delete(deleteProject);

export default router;

