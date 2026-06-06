import { Request, Response } from 'express';
import { contractorService } from './contractorService';
import { AuthRequest } from '../../core/middleware/authMiddleware';

export const getContractors = async (req: Request, res: Response) => {
  try {
    const { county, specializations } = req.query;
    const specArray = specializations ? (specializations as string).split(',') : undefined;
    
    const contractors = await contractorService.getContractors(county as string, specArray);
    res.json(contractors);
  } catch (error) {
    console.error('getContractors error:', error);
    res.status(500).json({ message: 'Eroare la preluarea constructorilor' });
  }
};

export const getContractorById = async (req: Request, res: Response) => {
  try {
    const contractor = await contractorService.getContractorById(Number(req.params.id));
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
    const { rating, comment, projectId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating invalid' });
    }

    if (!projectId) {
      return res.status(400).json({ message: 'Proiectul trebuie specificat' });
    }

    const review = await contractorService.addReview(contractorId, reviewerId, rating, comment, projectId);
    res.json({ success: true, review });
  } catch (error: any) {
    console.error('addReview error:', error);
    if (error.message === 'NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE') {
      return res.status(403).json({ message: 'Nu poți lăsa o recenzie fără un contract acceptat pe acest proiect.' });
    }
    res.status(500).json({ message: 'Eroare la adăugarea recenziei' });
  }
};

export const getAcceptedProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projects = await contractorService.getAcceptedProjects(userId);
    res.json(projects);
  } catch (error) {
    console.error('getAcceptedProjects error:', error);
    res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
  }
};
