import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { projectService } from '../services/projectService';

// Creare Proiect nou
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Neautorizat' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Neautorizat' });
      return;
    }

    const projects = await projectService.getUserProjects(userId);
    res.json(projects);
  } catch (error) {
    console.error('Eroare preluare proiecte:', error);
    res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
  }
};

// Preluare proiect dupa ID
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Neautorizat' });
      return;
    }

    const projectId = parseInt(req.params.id as string);
    if (isNaN(projectId)) {
      res.status(400).json({ message: 'ID proiect invalid' });
      return;
    }

    const project = await projectService.getProjectById(projectId, userId);
    res.json(project);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ message: 'Proiectul nu a fost găsit' });
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ message: 'Acces interzis' });
    } else {
      console.error('Eroare preluare proiect:', error);
      res.status(500).json({ message: 'Eroare la preluarea proiectului' });
    }
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Neautorizat' });
      return;
    }

    const projectId = parseInt(req.params.id as string);
    if (isNaN(projectId)) {
      res.status(400).json({ message: 'ID proiect invalid' });
      return;
    }

    const updatedProject = await projectService.updateProject(projectId, userId, req.body);
    res.status(200).json(updatedProject);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ message: 'Proiectul nu a fost găsit' });
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ message: 'Acces interzis' });
    } else {
      console.error('Eroare la actualizare proiect:', error);
      res.status(500).json({ message: 'Eroare la actualizarea proiectului' });
    }
  }
};

// Stergere proiect
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Neautorizat' }); return; }

    const projectId = parseInt(req.params.id as string);
    if (isNaN(projectId)) { res.status(400).json({ message: 'ID invalid' }); return; }

    await projectService.deleteProject(projectId, userId);
    res.status(200).json({ message: 'Proiect șters cu succes' });
  } catch (error: any) {
    if (error.message === 'FORBIDDEN_OR_NOT_FOUND') {
      res.status(403).json({ message: 'Acces interzis sau proiect inexistent' });
    } else {
      console.error('Eroare ștergere proiect:', error);
      res.status(500).json({ message: 'Eroare la ștergerea proiectului' });
    }
  }
};
