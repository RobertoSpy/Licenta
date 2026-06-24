import { quoteService } from '../quoteService';
import { prismaMock } from '../../../../tests/setup';
import { QuoteStatus } from '@prisma/client';

describe('Quote Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestQuotes', () => {
    it('creates new quotes for contractors without existing quotes', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
        { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
      prismaMock.contractorQuote.create.mockResolvedValue({} as any);

      const result = await quoteService.requestQuotes(1, [10, 11], 'Message');

      expect(result.count).toBe(2);
      expect(prismaMock.contractorQuote.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ contractorId: 10, projectId: 1 })
      }));
    });

    it('creates quotes for various phases to test specializations map', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [
        { name: 'Structură' }, { name: 'Planșeu & Coroană' }, { name: 'Termoizolație & Hidroizolație' },
        { name: 'Acoperiș' }, { name: 'Tâmplărie' }, { name: 'Instalații' }, { name: 'Finisaje' }, { name: 'Amenajări Exterioare' }, { name: 'Unknown' }
      ] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 10, specializations: ['CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
      prismaMock.contractorQuote.create.mockResolvedValue({} as any);

      const result = await quoteService.requestQuotes(1, [10]);
      expect(result.count).toBeGreaterThan(0);
    });

    it('does not create duplicate quote if contractor already has PENDING quote for project', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
        { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findUnique.mockImplementation((async (args: any) => {
        if (args.where?.contractorId_projectId?.contractorId === 10) return { id: 99, phases: [] } as any;
        return null;
      }) as any);
      prismaMock.contractorQuote.create.mockResolvedValue({} as any);
      prismaMock.contractorQuote.update.mockResolvedValue({} as any);

      const result = await quoteService.requestQuotes(1, [10, 11], 'Message');

      expect(result.count).toBe(1);
      expect(prismaMock.contractorQuote.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ contractorId: 11 })
      }));
    });

    it('creates new quote if previous quote was REJECTED (contractor can be re-invited) - Behavior defined as blocked', async () => {
      // Currently, the implementation blocks any existing quote regardless of status.
      // So if it was REJECTED, they cannot be re-invited unless the code changes.
      // The user asked to explicitly document this behavior in the test.
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
        { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findUnique.mockImplementation((async (args: any) => {
        if (args.where?.contractorId_projectId?.contractorId === 10) return { id: 99, status: QuoteStatus.REJECTED, phases: [] } as any;
        return null;
      }) as any);
      prismaMock.contractorQuote.create.mockResolvedValue({} as any);
      prismaMock.contractorQuote.update.mockResolvedValue({} as any);

      const result = await quoteService.requestQuotes(1, [10, 11], 'Message');

      expect(result.count).toBe(1); // Only contractor 11 gets a new quote, 10 gets updated
      expect(prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ contractorId: 11 })
      }));
    });

    it('returns count=0 with descriptive message when all contractors already have quotes', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
        { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ id: 99, phases: [{ id: 'phase1' }] } as any);

      const result = await quoteService.requestQuotes(1, [10, 11]);

      expect(result).toEqual({ count: 0, message: 'Nu s-au putut crea cereri noi. Posibil nepotriviri de specializare sau cereri deja trimise.' });
      expect(prismaMock.contractorQuote.create).not.toHaveBeenCalled();
    });
  });

  describe('submitQuote', () => {
    it('throws if totalAmount is negative', async () => {
      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: -50, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
    });

    it('throws if totalAmount is 0', async () => {
      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: 0, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
    });

    it('throws if contractor profile is not found', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue(null);

      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Contractor profile not found');
    });

    it('throws if quote is not found', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue(null);

      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Quote not found');
    });

    it('throws if quote does not belong to contractor', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 99 } as any);

      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Unauthorized');
    });

    it('throws if quote is already in ACCEPTED status (cannot re-submit)', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: QuoteStatus.ACCEPTED } as any);

      await expect(
        quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: Nu se poate retrimite o ofertă deja acceptată');
    });

    it('throws if quoteId is missing for normal offers', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      await expect(
        quoteService.submitQuote(undefined, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: quoteId este necesar pentru ofertele normale');
    });

    it('updates quote to SENT with valid data', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: QuoteStatus.PENDING } as any);
      prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: QuoteStatus.SENT } as any);

      const result = await quoteService.submitQuote(1, 100, { totalAmount: 1500, executionDays: 14, acceptsBOM: false, message: 'My offer' });

      expect(prismaMock.contractorQuote.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: QuoteStatus.SENT,
          totalAmount: 1500,
          executionDays: 14,
          message: 'My offer',
          acceptsBOM: false
        })
      });
      expect(result.status).toBe(QuoteStatus.SENT);
    });

    it('updates quote to SENT with valid data including selectedPhases', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: QuoteStatus.PENDING } as any);
      prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: QuoteStatus.SENT } as any);

      await quoteService.submitQuote(1, 100, { totalAmount: 1500, executionDays: 14, acceptsBOM: false, selectedPhases: [1, 2] });

      expect(prismaMock.contractorQuote.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          phases: { set: [{ id: 1 }, { id: 2 }] }
        })
      }));
    });

    it('throws if selfInitiated without projectId or selectedPhases', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      
      await expect(
        quoteService.submitQuote(1, 100, { selfInitiated: true, totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: projectId și selectedPhases sunt necesare pentru oferte inițiate de constructor');
    });

    it('throws if selectedPhases do not exist in DB for selfInitiated quote', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1 } as any]);
      
      await expect(
        quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1, 2], totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: Unele faze nu există');
    });

    it('throws if contractor specialization does not match the phase', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50, specializations: ['FINISAJE'] } as any);
      prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1, name: 'Fundație' } as any]);
      
      await expect(
        quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1], totalAmount: 1000, executionDays: 10, acceptsBOM: true })
      ).rejects.toThrow('Validation: Specializarea dumneavoastră nu vă permite să licitați pe etapa Fundație');
    });

    it('upserts a quote when selfInitiated is true and specializations match', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50, specializations: ['FUNDATII'] } as any);
      prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1, name: 'Fundație' } as any]);
      prismaMock.contractorQuote.upsert.mockResolvedValue({ id: 2, status: QuoteStatus.SENT } as any);

      const result = await quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1], totalAmount: 1000, executionDays: 10, acceptsBOM: true });
      
      expect(prismaMock.contractorQuote.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { contractorId_projectId: { contractorId: 50, projectId: 10 } },
        create: expect.objectContaining({ projectId: 10, contractorId: 50, status: QuoteStatus.SENT })
      }));
      expect(result.status).toBe(QuoteStatus.SENT);
    });
  });

  describe('acceptQuote', () => {
    it('throws if quote is not found', async () => {
      prismaMock.contractorQuote.findUnique.mockResolvedValue(null);

      await expect(quoteService.acceptQuote(1, 100)).rejects.toThrow('Quote not found');
    });

    it('throws if project does not belong to client', async () => {
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ project: { userId: 99 } } as any);

      await expect(quoteService.acceptQuote(1, 100)).rejects.toThrow('Unauthorized');
    });

    it('acceptQuote on already-accepted quote is idempotent or throws — behavior defined', async () => {
      // Definit să fie idempotent
      const existingAcceptedQuote = { id: 1, status: QuoteStatus.ACCEPTED, project: { userId: 100 } };
      prismaMock.contractorQuote.findUnique.mockResolvedValue(existingAcceptedQuote as any);

      const result = await quoteService.acceptQuote(1, 100);

      expect(result).toEqual(existingAcceptedQuote);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('acceptQuote rejects all other quotes for same project atomically', async () => {
      prismaMock.contractorQuote.findUnique.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: QuoteStatus.SENT,
        project: { userId: 100 },
        phases: [{ id: 101 }]
      } as any);

      // Mocam transaction-ul astfel încât să execute callback-ul intern (tx va fi prismaMock)
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaMock);
      });

      prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: QuoteStatus.ACCEPTED } as any);
      prismaMock.contractorQuote.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await quoteService.acceptQuote(1, 100);

      expect(prismaMock.contractorQuote.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: QuoteStatus.ACCEPTED }
      });

      expect(prismaMock.contractorQuote.updateMany).toHaveBeenCalledWith({
        where: {
          id: { not: 1 },
          phases: { some: { id: { in: [101] } } },
          status: { in: [QuoteStatus.PENDING, QuoteStatus.SENT, QuoteStatus.NEGOTIATING] }
        },
        data: { 
          status: QuoteStatus.REJECTED,
          clientMessage: 'Etapele au fost atribuite altei firme.'
        }
      });

      expect(result.status).toBe(QuoteStatus.ACCEPTED);
    });

    it('acceptQuote does not reject quotes for other projects of same contractor', async () => {
      // Verificăm argumentele trimise lui updateMany
      prismaMock.contractorQuote.findUnique.mockResolvedValue({
        id: 1,
        projectId: 5,
        status: QuoteStatus.SENT,
        project: { userId: 100 },
        phases: [{ id: 101 }]
      } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => await callback(prismaMock));

      await quoteService.acceptQuote(1, 100);

      const updateManyCallArgs = prismaMock.contractorQuote.updateMany.mock.calls[0][0];
      // Verificăm că filterează strict pe faza 101
      expect(((updateManyCallArgs.where as any)?.phases?.some?.id as any)?.in).toContain(101);
    });
  });

  describe('getQuotesForClient', () => {
    it('throws if project not found', async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);
      await expect(quoteService.getQuotesForClient(1, 100)).rejects.toThrow('Project not found');
    });

    it('throws Unauthorized if project belongs to another user', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ userId: 99 } as any);
      await expect(quoteService.getQuotesForClient(1, 100)).rejects.toThrow('Unauthorized');
    });

    it('returns quotes for project', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ userId: 100 } as any);
      prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

      const result = await quoteService.getQuotesForClient(1, 100);
      expect(result.length).toBe(2);
      expect(prismaMock.contractorQuote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 1 } })
      );
    });
  });

  describe('getQuotesForContractor', () => {
    it('throws if contractor profile not found', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue(null);
      await expect(quoteService.getQuotesForContractor(100)).rejects.toThrow('Contractor profile not found');
    });

    it('returns quotes for contractor', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 } as any);
      prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }] as any);

      const result = await quoteService.getQuotesForContractor(100);
      expect(result.data.length).toBe(1);
      expect(prismaMock.contractorQuote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractorId: 50 } })
      );
    });
  });
});
