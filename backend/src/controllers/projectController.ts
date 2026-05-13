import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { projectService } from '../services/projectService';

// Creare Proiect nou
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const title = req.body?.title || `Proiect nou - ${new Date().toLocaleDateString()}`;
    const project = await projectService.createProject(userId, title);
    res.status(201).json(project);
  } catch (error) {
    console.error('Eroare creare proiect:', error);
    res.status(500).json({ message: 'Eroare la crearea proiectului' });
  }
};

// Preluare proiecte user curent
export const getUserProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await projectService.getUserProjects(req.user!.id);
    res.json(projects);
  } catch (error) {
    console.error('Eroare preluare proiecte:', error);
    res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
  }
};

// Preluare proiect după ID
// tenantGuard a verificat ownership și a atașat proiectul la req.project
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  // tenantGuard garantează că req.project este întotdeauna populat pe această rută
  res.json((req as any).project);
};

// Actualizare proiect
// tenantGuard a verificat ownership înainte de apelul acestui controller
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id as string);
    const updatedProject = await projectService.updateProject(projectId, req.body);
    res.status(200).json(updatedProject);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ message: 'Proiectul nu a fost găsit' });
    } else {
      console.error('Eroare la actualizare proiect:', error);
      res.status(500).json({ message: 'Eroare la actualizarea proiectului' });
    }
  }
};

// Ștergere proiect
// tenantGuard a verificat ownership înainte de apelul acestui controller
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id as string);
    await projectService.deleteProject(projectId);
    res.status(200).json({ message: 'Proiect șters cu succes' });
  } catch (error: any) {
    console.error('Eroare ștergere proiect:', error);
    res.status(500).json({ message: 'Eroare la ștergerea proiectului' });
  }
};
