import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest } from '../../core/middleware/authMiddleware';
import { marketService } from './marketService';

/**
 * Client: Publică proiectul pentru licitație (bidding)
 * POST /api/market/projects/:id/publish
 */
export const publishProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Proiectul nu a fost găsit' });
      return;
    }

    if (project.userId !== req.user?.id) {
      res.status(403).json({ error: 'Nu ești autorizat să publici acest proiect' });
      return;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { isPublishedForBidding: true }
    });

    res.json({ message: 'Proiectul a fost publicat cu succes în marketplace.', project: updatedProject });
  } catch (error) {
    console.error('[marketController.publishProject] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Contractor: Vede feed-ul de proiecte disponibile
 * GET /api/market/projects/feed
 */
export const getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Neautorizat' });
      return;
    }

    // Găsim profilul de contractor
    const contractor = await prisma.contractorProfile.findUnique({
      where: { userId }
    });

    if (!contractor) {
      res.status(403).json({ error: 'Trebuie să fii înregistrat ca și constructor.' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { 
        isPublishedForBidding: true
      },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        constructionPhases: {
          orderBy: { phaseOrder: 'asc' },
          include: { contractor: { select: { companyName: true } } }
        },
        contractorQuotes: {
          where: { contractorId: contractor.id },
          select: { status: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const isVerified = contractor.isVerified;

    // Mascăm informațiile sensibile pentru contractorii neverificați
    const sanitizedProjects = projects.map(p => {
      if (isVerified) {
        return p;
      } else {
        // ascundem telefonul și limităm alte date
        return {
          ...p,
          user: {
            name: p.user.name,
            email: p.user.email,
            phone: '*** (Cont Neverificat)'
          }
        };
      }
    });

    res.json({ projects: sanitizedProjects, isVerified });
  } catch (error) {
    console.error('[marketController.getFeed] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Contractor: Trimite o ofertă (Quote) pentru un proiect
 * POST /api/market/projects/:id/quotes
 */
export const submitQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    const userId = req.user?.id;
    const { totalAmount, executionDays, message, selectedPhases } = req.body;

    if (!userId || isNaN(projectId) || !selectedPhases || !Array.isArray(selectedPhases)) {
      res.status(400).json({ error: 'Date invalide' });
      return;
    }

    const contractor = await prisma.contractorProfile.findUnique({
      where: { userId }
    });

    if (!contractor) {
      res.status(403).json({ error: 'Trebuie să fii constructor pentru a oferta.' });
      return;
    }

    if (!contractor.isVerified) {
      res.status(403).json({ error: 'Trebuie să ai contul verificat pentru a putea trimite oferte.' });
      return;
    }

    // Upsert quote
    const quote = await prisma.contractorQuote.upsert({
      where: {
        contractorId_projectId: {
          contractorId: contractor.id,
          projectId: projectId
        }
      },
      update: {
        totalAmount,
        executionDays,
        message,
        status: 'SENT',
        phases: {
          set: selectedPhases.map((id: number) => ({ id }))
        }
      },
      create: {
        contractorId: contractor.id,
        projectId,
        totalAmount,
        executionDays,
        message,
        status: 'SENT',
        phases: {
          connect: selectedPhases.map((id: number) => ({ id }))
        }
      }
    });

    res.json({ message: 'Ofertă trimisă cu succes.', quote });
  } catch (error) {
    console.error('[marketController.submitQuote] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Client: Vede ofertele primite pentru proiectul său
 * GET /api/market/projects/:id/quotes
 */
export const getProjectQuotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    const userId = req.user?.id;

    if (!userId || isNaN(projectId)) {
      res.status(400).json({ error: 'Date invalide' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.userId !== userId) {
      res.status(403).json({ error: 'Nu ai acces la acest proiect.' });
      return;
    }

    const quotes = await prisma.contractorQuote.findMany({
      where: { projectId },
      include: {
        contractor: {
          include: {
            user: { select: { name: true, phone: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(quotes);
  } catch (error) {
    console.error('[marketController.getProjectQuotes] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Client: Acceptă o ofertă
 * POST /api/market/quotes/:quoteId/accept
 */
export const acceptQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quoteId = parseInt(req.params.quoteId as string, 10);
    const userId = req.user?.id;

    if (!userId || isNaN(quoteId)) {
      res.status(400).json({ error: 'Date invalide' });
      return;
    }

    const quote = await prisma.contractorQuote.findUnique({
      where: { id: quoteId },
      include: { project: true, phases: true }
    });

    if (!quote || quote.project.userId !== userId) {
      res.status(403).json({ error: 'Acces interzis' });
      return;
    }

    // Acceptăm oferta curentă
    const acceptedQuote = await prisma.contractorQuote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' }
    });

    // Actualizăm fazele selectate
    if (quote.phases && quote.phases.length > 0) {
      await prisma.constructionPhase.updateMany({
        where: {
          id: { in: quote.phases.map((p: any) => p.id) },
          projectId: quote.projectId
        },
        data: {
          contractorId: quote.contractorId,
          quoteId: quote.id
        }
      });
    }

    // Nu mai respingem automat toate celelalte oferte
    // Opțional, aici s-ar putea face logica pentru a respinge ofertele care concurează EXACT pe aceleași etape
    // dar deocamdată o să le lăsăm ca atare, oferind flexibilitate clientului.

    res.json({ message: 'Ofertă acceptată cu succes.' });
  } catch (error) {
    console.error('[marketController.acceptQuote] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Client: Refuză o ofertă (cu mesaj opțional)
 * POST /api/market/quotes/:quoteId/reject
 */
export const rejectQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quoteId = parseInt(req.params.quoteId as string, 10);
    const userId = req.user?.id;
    const { clientMessage } = req.body;

    if (!userId || isNaN(quoteId)) {
      res.status(400).json({ error: 'Date invalide' });
      return;
    }

    const quote = await prisma.contractorQuote.findUnique({
      where: { id: quoteId },
      include: { project: true }
    });

    if (!quote || quote.project.userId !== userId) {
      res.status(403).json({ error: 'Acces interzis' });
      return;
    }

    await prisma.contractorQuote.update({
      where: { id: quoteId },
      data: { 
        status: 'REJECTED',
        clientMessage: clientMessage || null
      }
    });

    res.json({ message: 'Ofertă refuzată cu succes.' });
  } catch (error) {
    console.error('[marketController.rejectQuote] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};

/**
 * Returnează datele istorice INSSE CNS107D
 * GET /api/market/history
 */
export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await marketService.getIndexHistory();
    res.json({ data });
  } catch (error) {
    console.error('[marketController.getHistory] Eroare:', error);
    res.status(500).json({ error: 'Eroare la returnarea datelor istorice.' });
  }
};

/**
 * Returnează prognoza AI
 * GET /api/market/forecast
 */
export const getForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    const forecast = await marketService.getForecast();
    res.json(forecast);
  } catch (error) {
    console.error('[marketController.getForecast] Eroare:', error);
    res.status(500).json({ error: 'Eroare la generarea prognozei.' });
  }
};

/**
 * Returnează rezumatul pieței
 * GET /api/market/summary
 */
export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await marketService.getSummary();
    res.json(summary);
  } catch (error) {
    console.error('[marketController.getSummary] Eroare:', error);
    res.status(500).json({ error: 'Eroare la generarea rezumatului.' });
  }
};
