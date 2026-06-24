import { Request, Response } from 'express';
import { contractorService } from './contractorService';
import { AuthRequest } from '../../core/middleware/authMiddleware';

export const getContractors = async (req: Request, res: Response) => {
  try {
    const { county, specializations } = req.query;
    const specArray = specializations ? (specializations as string).split(',') : undefined;
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await contractorService.getContractors(county as string, specArray, page, limit);
    res.json(result);
  } catch (error) {
    console.error('getContractors error:', error);
    res.status(500).json({ message: 'Eroare la preluarea constructorilor' });
  }
};

export const getContractorById = async (req: Request, res: Response) => {
  try {
    const contractorId = parseInt(req.params.id as string);
    if (isNaN(contractorId)) {
      return res.status(400).json({ message: 'ID constructor invalid' });
    }

    const contractor = await contractorService.getContractorById(contractorId);
    if (!contractor) {
      return res.status(404).json({ message: 'Constructorul nu a fost găsit' });
    }
    res.json(contractor);
  } catch (error) {
    console.error('getContractorById error:', error);
    res.status(500).json({ message: 'Eroare la preluarea constructorului' });
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await contractorService.getProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ message: 'Profilul nu a fost găsit' });
    }
    res.json(profile);
  } catch (error) {
    console.error('getMyProfile error:', error);
    res.status(500).json({ message: 'Eroare la preluarea profilului' });
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await contractorService.updateProfile(userId, req.body);
    res.json(profile);
  } catch (error) {
    console.error('updateMyProfile error:', error);
    res.status(500).json({ message: 'Eroare la actualizarea profilului' });
  }
};

export const addReview = async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user!.id;
    const contractorId = parseInt(req.params.id as string);
    if (isNaN(contractorId)) {
      return res.status(400).json({ message: 'ID constructor invalid' });
    }

    const { rating, comment, projectId } = req.body;

    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating invalid' });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0 || comment.length > 1000) {
      return res.status(400).json({ message: 'Comentariu invalid' });
    }

    const parsedProjectId = parseInt(projectId as string);
    if (isNaN(parsedProjectId)) {
      return res.status(400).json({ message: 'Proiectul trebuie specificat' });
    }

    const review = await contractorService.addReview(contractorId, reviewerId, rating, comment, parsedProjectId);
    res.json({ success: true, review });
  } catch (error: any) {
    console.error('addReview error:', error);
    if (error.message === 'NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE') {
      return res.status(403).json({ message: 'Nu poți lăsa o recenzie fără un contract acceptat pe acest proiect.' });
    }
    if (error.message === 'ALREADY_REVIEWED') {
      return res.status(409).json({ message: 'Ai lăsat deja o recenzie pentru acest proiect.' });
    }
    res.status(500).json({ message: 'Eroare la adăugarea recenziei' });
  }
};

export const getAcceptedProjects = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.user!.id;
    const projects = await contractorService.getAcceptedProjects(userId, page, limit);
    res.json(projects);
  } catch (error) {
    console.error('getAcceptedProjects error:', error);
    res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
  }
};
