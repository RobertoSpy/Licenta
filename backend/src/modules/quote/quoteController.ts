import { Response } from 'express';
import { AuthRequest } from '../../core/middleware/authMiddleware';
import { quoteService } from './quoteService';

export const requestQuotes = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, contractorIds, message } = req.body;
    // Un plus de securitate: verificăm dacă proiectul e al clientului
    const result = await quoteService.requestQuotes(projectId, contractorIds, message);
    res.json(result);
  } catch (error) {
    console.error('requestQuotes error:', error);
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
    res.status(500).json({ message: 'Eroare la preluarea ofertelor' });
  }
};

export const getContractorQuotes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const quotes = await quoteService.getQuotesForContractor(userId);
    res.json(quotes);
  } catch (error) {
    console.error('getContractorQuotes error:', error);
    res.status(500).json({ message: 'Eroare la preluarea lead-urilor' });
  }
};

export const submitQuote = async (req: AuthRequest, res: Response) => {
  try {
    const quoteId = Number(req.params.id);
    const userId = req.user!.id;
    const result = await quoteService.submitQuote(quoteId, userId, req.body);
    res.json(result);
  } catch (error: any) {
    console.error('submitQuote error:', error);
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: 'Acțiune nepermisă' });
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
    res.status(500).json({ message: 'Eroare la acceptarea ofertei' });
  }
};
