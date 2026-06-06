import { prisma } from '../../lib/prisma';

export const contractorService = {
  async getContractors(county?: string, specializations?: string[]) {
    const whereClause: any = {
      isVerified: true,
      isActive: true,
    };

    if (county) {
      whereClause.county = county;
    }

    if (specializations && specializations.length > 0) {
      whereClause.specializations = {
        hasSome: specializations,
      };
    }

    return prisma.contractorProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: {
        avgRating: 'desc',
      },
    });
  },

  async getContractorById(id: number) {
    return prisma.contractorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        reviews: {
          include: {
            reviewer: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  },

  async updateProfile(userId: number, data: any) {
    return prisma.contractorProfile.update({
      where: { userId },
      data: {
        companyName: data.companyName,
        description: data.description,
        specializations: data.specializations,
        county: data.county,
        coverageRadius: data.coverageRadius,
        yearsExperience: data.yearsExperience,
        portfolioUrls: data.portfolioUrls,
      }
    });
  },

  async getProfileByUserId(userId: number) {
    return prisma.contractorProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true } }
      }
    });
  },

  async addReview(contractorId: number, reviewerId: number, rating: number, comment: string, projectId: number) {
    // 1. Verificăm dacă există o ofertă ACCEPTED între acest client și acest constructor pentru proiectul dat
    const quote = await prisma.contractorQuote.findUnique({
      where: {
        contractorId_projectId: { contractorId, projectId },
        project: {
          userId: reviewerId
        },
        status: 'ACCEPTED'
      }
    });

    if (!quote) {
      throw new Error('NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE');
    }

    // 2. Creăm recenzia
    const review = await prisma.contractorReview.create({
      data: {
        contractorId,
        reviewerId,
        projectId,
        rating,
        comment
      }
    });

    // 3. Recalculăm media ratingului și numărul de proiecte
    const allReviews = await prisma.contractorReview.findMany({
      where: { contractorId }
    });

    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

    await prisma.contractorProfile.update({
      where: { id: contractorId },
      data: { 
        avgRating,
        completedProjects: { increment: 1 } // un review implică terminarea proiectului, deci incrementăm
      }
    });

    return review;
  },

  /**
   * Returnează proiectele pentru care constructorul a câștigat oferta (status ACCEPTED).
   * userId = user-ul logat (CONTRACTOR)
   */
  async getAcceptedProjects(userId: number) {
    // Găsim profilul constructorului
    const profile = await prisma.contractorProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const quotes = await prisma.contractorQuote.findMany({
      where: {
        contractorId: profile.id,
        status: 'ACCEPTED'
      },
      include: {
        project: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return quotes.map(q => ({
      id: q.project.id,
      name: (q.project as any).title ?? `Proiect #${q.project.id}`,
      county: (q.project as any).county ?? null,
      buildingPurpose: (q.project as any).buildingPurpose ?? null,
      totalArea: (q.project as any).totalArea ?? null,
      createdAt: q.project.createdAt,
      user: q.project.user,
      totalAmount: q.totalAmount
    }));
  }
};
