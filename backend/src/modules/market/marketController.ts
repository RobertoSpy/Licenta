import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest } from '../../core/middleware/authMiddleware';

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
      where: { isPublishedForBidding: true },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
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
    const { totalAmount, executionDays, message } = req.body;

    if (!userId || isNaN(projectId)) {
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
        status: 'SENT'
      },
      create: {
        contractorId: contractor.id,
        projectId,
        totalAmount,
        executionDays,
        message,
        status: 'SENT'
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
      include: { project: true }
    });

    if (!quote || quote.project.userId !== userId) {
      res.status(403).json({ error: 'Acces interzis' });
      return;
    }

    // Acceptăm oferta curentă
    await prisma.contractorQuote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' }
    });

    // Opțional: Putem respinge celelalte oferte pentru același proiect
    await prisma.contractorQuote.updateMany({
      where: { 
        projectId: quote.projectId,
        id: { not: quoteId }
      },
      data: { status: 'REJECTED' }
    });

    res.json({ message: 'Ofertă acceptată cu succes.' });
  } catch (error) {
    console.error('[marketController.acceptQuote] Eroare:', error);
    res.status(500).json({ error: 'Eroare internă de server' });
  }
};
