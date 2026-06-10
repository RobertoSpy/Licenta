import { prisma } from '../../lib/prisma';
import { QuoteStatus, ContractorSpecialization } from '@prisma/client';

const mapPhaseToSpecializations = (phaseName: string): ContractorSpecialization[] => {
  // Strip the number prefix like "1. "
  const name = phaseName.replace(/^\d+\.\s*/, '');
  
  switch (name) {
    case 'Fundație': return ['FUNDATII', 'CONSTRUCTII_GENERALE'];
    case 'Structură': return ['STRUCTURA', 'CONSTRUCTII_GENERALE'];
    case 'Planșeu': return ['PLANSEU', 'CONSTRUCTII_GENERALE'];
    case 'Acoperiș': return ['ACOPERIS', 'CONSTRUCTII_GENERALE'];
    case 'Finisaje': return ['FINISAJE', 'CONSTRUCTII_GENERALE'];
    case 'Tâmplărie': return ['TAMPLARIE', 'CONSTRUCTII_GENERALE'];
    case 'Termoizolație': return ['IZOLATII', 'CONSTRUCTII_GENERALE'];
    case 'Instalații Electrice': return ['INSTALATII_ELECTRICE', 'CONSTRUCTII_GENERALE'];
    case 'Instalații Sanitare și Termice': return ['INSTALATII_SANITARE', 'CONSTRUCTII_GENERALE'];
    default: return ['CONSTRUCTII_GENERALE'];
  }
}

export const quoteService = {
  async requestQuotes(projectId: number, contractorIds: number[], message?: string, phaseIds?: number[]) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { constructionPhases: true }
    });
    
    if (!project) throw new Error('Project not found');

    const contractors = await prisma.contractorProfile.findMany({
      where: { id: { in: contractorIds } }
    });

    let quotesCreated = 0;

    for (const contractor of contractors) {
      // Filtrăm etapele dacă utilizatorul a selectat etape specifice
      const phasesToProcess = phaseIds 
        ? project.constructionPhases.filter(p => phaseIds.includes(p.id))
        : project.constructionPhases;

      for (const phase of phasesToProcess) {
        if (phase.contractorId !== null) continue; // Skip already awarded phases

        const allowedSpecs = mapPhaseToSpecializations(phase.name);
        const canBid = contractor.specializations.some(spec => allowedSpecs.includes(spec));

        if (canBid) {
          // Creem oferta doar dacă nu există deja pentru această fază
          const existingQuote = await prisma.contractorQuote.findUnique({
            where: {
              contractorId_projectId: {
                contractorId: contractor.id,
                projectId: projectId
              }
            },
            include: { phases: true }
          });

          if (!existingQuote) {
            await prisma.contractorQuote.create({
              data: {
                projectId,
                contractorId: contractor.id,
                message,
                status: QuoteStatus.PENDING,
                phases: { connect: [{ id: phase.id }] }
              }
            });
            quotesCreated++;
          } else {
             if (!existingQuote.phases.find(p => p.id === phase.id)) {
                 await prisma.contractorQuote.update({
                     where: { id: existingQuote.id },
                     data: { phases: { connect: [{ id: phase.id }] } }
                 });
             }
          }
        }
      }
    }

    if (quotesCreated === 0) {
      return { count: 0, message: 'Nu s-au putut crea cereri noi. Posibil nepotriviri de specializare sau cereri deja trimise.' };
    }

    return { count: quotesCreated };
  },

  async getQuotesForClient(projectId: number, userId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    if (project.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return prisma.contractorQuote.findMany({
      where: { projectId },
      include: {
        contractor: {
          include: { 
            user: { select: { name: true, email: true, phone: true } },
            reviews: {
              where: {
                reviewerId: userId,
                projectId: projectId
              }
            }
          }
        },
        phases: true
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
        },
        phases: true
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async submitQuote(quoteId: number | undefined, contractorUserId: number, data: { projectId?: number, selectedPhases?: number[], totalAmount: number, executionDays: number, message?: string, acceptsBOM: boolean, bomVariations?: any, selfInitiated?: boolean }) {
    if (data.totalAmount === undefined || data.totalAmount <= 0) {
      throw new Error('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
    }

    const profile = await prisma.contractorProfile.findUnique({ where: { userId: contractorUserId } });
    if (!profile) throw new Error('Contractor profile not found');

    let quote;

    if (data.selfInitiated) {
      if (!data.projectId || !data.selectedPhases || data.selectedPhases.length === 0) {
         throw new Error('Validation: projectId și selectedPhases sunt necesare pentru oferte inițiate de constructor');
      }
      
      const phases = await prisma.constructionPhase.findMany({ where: { id: { in: data.selectedPhases } }});
      if (!phases || phases.length !== data.selectedPhases.length) throw new Error('Validation: Unele faze nu există');
      
      // Validează specializarea pentru fiecare fază și verifică dacă nu a fost deja atribuită
      for (const phase of phases) {
          if (phase.contractorId !== null) {
              throw new Error(`Validation: Etapa ${phase.name} este deja atribuită altei firme.`);
          }
          const allowedSpecs = mapPhaseToSpecializations(phase.name);
          const canBid = profile.specializations.some(spec => allowedSpecs.includes(spec));
          if (!canBid) {
             throw new Error('Validation: Specializarea dumneavoastră nu vă permite să licitați pe etapa ' + phase.name);
          }
      }

      quote = await prisma.contractorQuote.upsert({
        where: {
          contractorId_projectId: {
            contractorId: profile.id,
            projectId: data.projectId
          }
        },
        update: {
          status: QuoteStatus.SENT,
          totalAmount: data.totalAmount,
          executionDays: data.executionDays,
          message: data.message,
          acceptsBOM: data.acceptsBOM,
          bomVariations: data.bomVariations ? data.bomVariations : undefined,
          phases: {
            set: data.selectedPhases.map(id => ({ id }))
          }
        },
        create: {
          projectId: data.projectId,
          contractorId: profile.id,
          status: QuoteStatus.SENT,
          totalAmount: data.totalAmount,
          executionDays: data.executionDays,
          message: data.message,
          acceptsBOM: data.acceptsBOM,
          bomVariations: data.bomVariations ? data.bomVariations : undefined,
          phases: {
            connect: data.selectedPhases.map(id => ({ id }))
          }
        }
      });
      return quote;
    }

    if (!quoteId) {
      throw new Error('Validation: quoteId este necesar pentru ofertele normale');
    }

    quote = await prisma.contractorQuote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new Error('Quote not found');
    if (quote.contractorId !== profile.id) {
      throw new Error('Unauthorized');
    }

    if (quote.status === QuoteStatus.ACCEPTED) {
      throw new Error('Validation: Nu se poate retrimite o ofertă deja acceptată');
    }

    return prisma.contractorQuote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.SENT,
        totalAmount: data.totalAmount,
        executionDays: data.executionDays,
        message: data.message,
        acceptsBOM: data.acceptsBOM,
        bomVariations: data.bomVariations ? data.bomVariations : undefined,
        phases: data.selectedPhases ? {
          set: data.selectedPhases.map(id => ({ id }))
        } : undefined
      }
    });
  },

  async acceptQuote(quoteId: number, userId: number) {
    const quote = await prisma.contractorQuote.findUnique({
      where: { id: quoteId },
      include: { project: true, phases: true }
    });

    if (!quote) throw new Error('Quote not found');
    if (quote.project.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (quote.status === QuoteStatus.ACCEPTED) {
      return quote;
    }

    return prisma.$transaction(async (tx) => {
      const acceptedQuote = await tx.contractorQuote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.ACCEPTED }
      });

      if (quote.phases.length > 0) {
        await tx.constructionPhase.updateMany({
          where: { id: { in: quote.phases.map(p => p.id) } },
          data: {
            contractorId: acceptedQuote.contractorId,
            quoteId: acceptedQuote.id
          }
        });

        // Respingem celelalte oferte pentru aceste faze
        await tx.contractorQuote.updateMany({
          where: {
            id: { not: quoteId },
            phases: { some: { id: { in: quote.phases.map(p => p.id) } } },
            status: { in: [QuoteStatus.PENDING, QuoteStatus.SENT, QuoteStatus.NEGOTIATING] }
          },
          data: {
            status: QuoteStatus.REJECTED,
            clientMessage: 'Etapele au fost atribuite altei firme.'
          }
        });
      }

      return acceptedQuote;
    });
  }
};
