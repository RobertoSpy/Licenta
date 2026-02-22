import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

// Creare Proiect nou
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Neautorizat' });
      return;
    }

    const { title, plotWidth, plotLength } = req.body;

    if (!title) {
      res.status(400).json({ message: 'Titlul este obligatoriu' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        title,
        plotWidth,
        plotLength,
        userId
      }
    });

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

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        bomItems: true
      }
    });

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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bomItems: {
          include: {
            material: true
          }
        }
      }
    });

    if (!project) {
      res.status(404).json({ message: 'Proiectul nu a fost găsit' });
      return;
    }

    if (project.userId !== userId) {
      res.status(403).json({ message: 'Acces interzis' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Eroare preluare proiect:', error);
    res.status(500).json({ message: 'Eroare la preluarea proiectului' });
  }
};
