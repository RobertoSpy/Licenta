import { prisma } from '../../lib/prisma';
import { QuoteStatus } from '@prisma/client';

export const quoteService = {
  async requestQuotes(projectId: number, contractorIds: number[], message?: string) {
    // Verificăm dacă există deja cereri, pentru a nu duplica
    const existingQuotes = await prisma.contractorQuote.findMany({
      where: {
        projectId,
        contractorId: { in: contractorIds }
      }
    });

    const existingContractorIds = existingQuotes.map(q => q.contractorId);
    const newContractorIds = contractorIds.filter(id => !existingContractorIds.includes(id));

    if (newContractorIds.length === 0) {
      return { count: 0, message: 'Cererile au fost deja trimise către acești constructori.' };
    }

    const quotesData = newContractorIds.map(contractorId => ({
      projectId,
      contractorId,
      message,
      status: QuoteStatus.PENDING
    }));

    const result = await prisma.contractorQuote.createMany({
      data: quotesData
    });

    return { count: result.count };
  },

  async getQuotesForClient(projectId: number, userId: number) {
    // Verificăm dacă proiectul aparține userului
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return prisma.contractorQuote.findMany({
      where: { projectId },
      include: {
        contractor: {
          include: { user: { select: { name: true, email: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  },

  async getQuotesForContractor(userId: number) {
    const profile = await prisma.contractorProfile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Contractor profile not found');

    return prisma.contractorQuote.findMany({
      where: { contractorId: profile.id },
      include: {
        project: {
          include: { 
            user: { select: { name: true, email: true } },
            bomItems: { include: { material: true } },
            planSnapshots: { where: { isPublished: true }, take: 1 }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async submitQuote(quoteId: number, contractorUserId: number, data: { totalAmount: number, executionDays: number, message?: string, acceptsBOM: boolean, bomVariations?: any }) {
    const profile = await prisma.contractorProfile.findUnique({ where: { userId: contractorUserId } });
    if (!profile) throw new Error('Contractor profile not found');

    const quote = await prisma.contractorQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.contractorId !== profile.id) {
      throw new Error('Unauthorized or not found');
    }

    return prisma.contractorQuote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.SENT,
        totalAmount: data.totalAmount,
        executionDays: data.executionDays,
        message: data.message,
        acceptsBOM: data.acceptsBOM,
        bomVariations: data.bomVariations ? data.bomVariations : undefined
      }
    });
  },

  async acceptQuote(quoteId: number, userId: number) {
    const quote = await prisma.contractorQuote.findUnique({
      where: { id: quoteId },
      include: { project: true }
    });

    if (!quote || quote.project.userId !== userId) {
      throw new Error('Unauthorized or not found');
    }

    // Marcați oferta ca acceptată
    const acceptedQuote = await prisma.contractorQuote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.ACCEPTED }
    });

    // Celelalte oferte pentru același proiect devin REJECTED
    await prisma.contractorQuote.updateMany({
      where: {
        projectId: quote.projectId,
        id: { not: quoteId }
      },
      data: { status: QuoteStatus.REJECTED }
    });

    return acceptedQuote;
  }
};
