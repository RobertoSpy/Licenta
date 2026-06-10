import { Response } from 'express';
import { AuthRequest } from '../../core/middleware/authMiddleware';
import { quoteService } from './quoteService';

export const requestQuotes = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, contractorIds, message, phaseIds } = req.body;
    if (!projectId || !contractorIds || !Array.isArray(contractorIds)) {
      return res.status(400).json({ message: 'Date de intrare invalide: projectId și contractorIds sunt obligatorii' });
    }

    const result = await quoteService.requestQuotes(projectId, contractorIds, message, phaseIds);
    if (result.count > 0) {
      return res.status(201).json({ count: result.count, message: 'Cereri trimise cu succes.' });
    } else {
      return res.status(200).json(result);
    }
  } catch (error: any) {
    console.error('requestQuotes error:', error);
    if (error.message === 'Unauthorized') return res.status(403).json({ message: 'Acțiune nepermisă' });
    res.status(500).json({ message: 'Eroare la trimiterea cererii de ofertă' });
  }
};

export const getClientQuotes = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const quotes = await quoteService.getQuotesForClient(Number(projectId), userId);
    res.json(quotes);
  } catch (error: any) {
    console.error('getClientQuotes error:', error);
    if (error.message === 'Unauthorized') return res.status(403).json({ message: 'Proiectul nu vă aparține' });
    if (error.message.includes('not found')) return res.status(404).json({ message: 'Proiectul nu a fost găsit' });
    res.status(500).json({ message: 'Eroare la preluarea ofertelor' });
  }
};

export const getContractorQuotes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const quotes = await quoteService.getQuotesForContractor(userId);
    res.json(quotes);
  } catch (error: any) {
    console.error('getContractorQuotes error:', error);
    if (error.message.includes('not found')) return res.status(404).json({ message: 'Profilul de constructor nu a fost găsit' });
    res.status(500).json({ message: 'Eroare la preluarea lead-urilor' });
  }
};

export const submitQuote = async (req: AuthRequest, res: Response) => {
  try {
    const quoteId = req.params.id ? Number(req.params.id) : undefined;
    const userId = req.user!.id;
    const result = await quoteService.submitQuote(quoteId, userId, req.body);
    res.json(result);
  } catch (error: any) {
    console.error('submitQuote error:', error);
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: 'Acțiune nepermisă' });
    if (error.message.includes('not found')) return res.status(404).json({ message: 'Profil sau ofertă inexistentă' });
    if (error.message.includes('Validation:')) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Eroare la trimiterea ofertei' });
  }
};

export const acceptQuote = async (req: AuthRequest, res: Response) => {
  try {
    const quoteId = Number(req.params.id);
    const userId = req.user!.id;
    const result = await quoteService.acceptQuote(quoteId, userId);
    res.json(result);
  } catch (error: any) {
    console.error('acceptQuote error:', error);
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: 'Acțiune nepermisă' });
    if (error.message.includes('not found')) return res.status(404).json({ message: 'Oferta nu a fost găsită' });
    if (error.message.includes('Validation:')) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Eroare la acceptarea ofertei' });
  }
};
