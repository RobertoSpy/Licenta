"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const quoteService_1 = require("../quoteService");
const setup_1 = require("../../../../tests/setup");
const client_1 = require("@prisma/client");
describe('Quote Service Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('requestQuotes', () => {
        it('creates new quotes for contractors without existing quotes', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
                { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
            setup_1.prismaMock.contractorQuote.create.mockResolvedValue({});
            const result = yield quoteService_1.quoteService.requestQuotes(1, [10, 11], 'Message');
            expect(result.count).toBe(2);
            expect(setup_1.prismaMock.contractorQuote.create).toHaveBeenCalledTimes(2);
            expect(setup_1.prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ contractorId: 10, projectId: 1 })
            }));
        }));
        it('creates quotes for various phases to test specializations map', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [
                    { name: 'Structură' }, { name: 'Planșeu & Coroană' }, { name: 'Termoizolație & Hidroizolație' },
                    { name: 'Acoperiș' }, { name: 'Tâmplărie' }, { name: 'Instalații' }, { name: 'Finisaje' }, { name: 'Amenajări Exterioare' }, { name: 'Unknown' }
                ] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 10, specializations: ['CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
            setup_1.prismaMock.contractorQuote.create.mockResolvedValue({});
            const result = yield quoteService_1.quoteService.requestQuotes(1, [10]);
            expect(result.count).toBeGreaterThan(0);
        }));
        it('does not create duplicate quote if contractor already has PENDING quote for project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
                { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findUnique.mockImplementation(((args) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b;
                if (((_b = (_a = args.where) === null || _a === void 0 ? void 0 : _a.contractorId_projectId) === null || _b === void 0 ? void 0 : _b.contractorId) === 10)
                    return { id: 99, phases: [] };
                return null;
            })));
            setup_1.prismaMock.contractorQuote.create.mockResolvedValue({});
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({});
            const result = yield quoteService_1.quoteService.requestQuotes(1, [10, 11], 'Message');
            expect(result.count).toBe(1);
            expect(setup_1.prismaMock.contractorQuote.create).toHaveBeenCalledTimes(1);
            expect(setup_1.prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ contractorId: 11 })
            }));
        }));
        it('creates new quote if previous quote was REJECTED (contractor can be re-invited) - Behavior defined as blocked', () => __awaiter(void 0, void 0, void 0, function* () {
            // Currently, the implementation blocks any existing quote regardless of status.
            // So if it was REJECTED, they cannot be re-invited unless the code changes.
            // The user asked to explicitly document this behavior in the test.
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
                { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findUnique.mockImplementation(((args) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b;
                if (((_b = (_a = args.where) === null || _a === void 0 ? void 0 : _a.contractorId_projectId) === null || _b === void 0 ? void 0 : _b.contractorId) === 10)
                    return { id: 99, status: client_1.QuoteStatus.REJECTED, phases: [] };
                return null;
            })));
            setup_1.prismaMock.contractorQuote.create.mockResolvedValue({});
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({});
            const result = yield quoteService_1.quoteService.requestQuotes(1, [10, 11], 'Message');
            expect(result.count).toBe(1); // Only contractor 11 gets a new quote, 10 gets updated
            expect(setup_1.prismaMock.contractorQuote.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ contractorId: 11 })
            }));
        }));
        it('returns count=0 with descriptive message when all contractors already have quotes', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 10, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
                { id: 11, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ id: 99, phases: [{ id: 'phase1' }] });
            const result = yield quoteService_1.quoteService.requestQuotes(1, [10, 11]);
            expect(result).toEqual({ count: 0, message: 'Nu s-au putut crea cereri noi. Posibil nepotriviri de specializare sau cereri deja trimise.' });
            expect(setup_1.prismaMock.contractorQuote.create).not.toHaveBeenCalled();
        }));
    });
    describe('submitQuote', () => {
        it('throws if totalAmount is negative', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: -50, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
        }));
        it('throws if totalAmount is 0', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 0, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
        }));
        it('throws if contractor profile is not found', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue(null);
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Contractor profile not found');
        }));
        it('throws if quote is not found', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Quote not found');
        }));
        it('throws if quote does not belong to contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 99 });
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Unauthorized');
        }));
        it('throws if quote is already in ACCEPTED status (cannot re-submit)', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: client_1.QuoteStatus.ACCEPTED });
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: Nu se poate retrimite o ofertă deja acceptată');
        }));
        it('throws if quoteId is missing for normal offers', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            yield expect(quoteService_1.quoteService.submitQuote(undefined, 100, { totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: quoteId este necesar pentru ofertele normale');
        }));
        it('updates quote to SENT with valid data', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: client_1.QuoteStatus.PENDING });
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: client_1.QuoteStatus.SENT });
            const result = yield quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1500, executionDays: 14, acceptsBOM: false, message: 'My offer' });
            expect(setup_1.prismaMock.contractorQuote.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: client_1.QuoteStatus.SENT,
                    totalAmount: 1500,
                    executionDays: 14,
                    message: 'My offer',
                    acceptsBOM: false
                })
            });
            expect(result.status).toBe(client_1.QuoteStatus.SENT);
        }));
        it('updates quote to SENT with valid data including selectedPhases', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ contractorId: 50, status: client_1.QuoteStatus.PENDING });
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: client_1.QuoteStatus.SENT });
            yield quoteService_1.quoteService.submitQuote(1, 100, { totalAmount: 1500, executionDays: 14, acceptsBOM: false, selectedPhases: [1, 2] });
            expect(setup_1.prismaMock.contractorQuote.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    phases: { set: [{ id: 1 }, { id: 2 }] }
                })
            }));
        }));
        it('throws if selfInitiated without projectId or selectedPhases', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { selfInitiated: true, totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: projectId și selectedPhases sunt necesare pentru oferte inițiate de constructor');
        }));
        it('throws if selectedPhases do not exist in DB for selfInitiated quote', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1 }]);
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1, 2], totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: Unele faze nu există');
        }));
        it('throws if contractor specialization does not match the phase', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50, specializations: ['FINISAJE'] });
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1, name: 'Fundație' }]);
            yield expect(quoteService_1.quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1], totalAmount: 1000, executionDays: 10, acceptsBOM: true })).rejects.toThrow('Validation: Specializarea dumneavoastră nu vă permite să licitați pe etapa Fundație');
        }));
        it('upserts a quote when selfInitiated is true and specializations match', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50, specializations: ['FUNDATII'] });
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue([{ id: 1, name: 'Fundație' }]);
            setup_1.prismaMock.contractorQuote.upsert.mockResolvedValue({ id: 2, status: client_1.QuoteStatus.SENT });
            const result = yield quoteService_1.quoteService.submitQuote(1, 100, { selfInitiated: true, projectId: 10, selectedPhases: [1], totalAmount: 1000, executionDays: 10, acceptsBOM: true });
            expect(setup_1.prismaMock.contractorQuote.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { contractorId_projectId: { contractorId: 50, projectId: 10 } },
                create: expect.objectContaining({ projectId: 10, contractorId: 50, status: client_1.QuoteStatus.SENT })
            }));
            expect(result.status).toBe(client_1.QuoteStatus.SENT);
        }));
    });
    describe('acceptQuote', () => {
        it('throws if quote is not found', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue(null);
            yield expect(quoteService_1.quoteService.acceptQuote(1, 100)).rejects.toThrow('Quote not found');
        }));
        it('throws if project does not belong to client', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ project: { userId: 99 } });
            yield expect(quoteService_1.quoteService.acceptQuote(1, 100)).rejects.toThrow('Unauthorized');
        }));
        it('acceptQuote on already-accepted quote is idempotent or throws — behavior defined', () => __awaiter(void 0, void 0, void 0, function* () {
            // Definit să fie idempotent
            const existingAcceptedQuote = { id: 1, status: client_1.QuoteStatus.ACCEPTED, project: { userId: 100 } };
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue(existingAcceptedQuote);
            const result = yield quoteService_1.quoteService.acceptQuote(1, 100);
            expect(result).toEqual(existingAcceptedQuote);
            expect(setup_1.prismaMock.$transaction).not.toHaveBeenCalled();
        }));
        it('acceptQuote rejects all other quotes for same project atomically', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({
                id: 1,
                projectId: 5,
                status: client_1.QuoteStatus.SENT,
                project: { userId: 100 },
                phases: [{ id: 101 }]
            });
            // Mocam transaction-ul astfel încât să execute callback-ul intern (tx va fi prismaMock)
            setup_1.prismaMock.$transaction.mockImplementation((callback) => __awaiter(void 0, void 0, void 0, function* () {
                return yield callback(setup_1.prismaMock);
            }));
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: client_1.QuoteStatus.ACCEPTED });
            setup_1.prismaMock.contractorQuote.updateMany.mockResolvedValue({ count: 2 });
            const result = yield quoteService_1.quoteService.acceptQuote(1, 100);
            expect(setup_1.prismaMock.contractorQuote.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: client_1.QuoteStatus.ACCEPTED }
            });
            expect(setup_1.prismaMock.contractorQuote.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { not: 1 },
                    phases: { some: { id: { in: [101] } } },
                    status: { in: [client_1.QuoteStatus.PENDING, client_1.QuoteStatus.SENT, client_1.QuoteStatus.NEGOTIATING] }
                },
                data: {
                    status: client_1.QuoteStatus.REJECTED,
                    clientMessage: 'Etapele au fost atribuite altei firme.'
                }
            });
            expect(result.status).toBe(client_1.QuoteStatus.ACCEPTED);
        }));
        it('acceptQuote does not reject quotes for other projects of same contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Verificăm argumentele trimise lui updateMany
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({
                id: 1,
                projectId: 5,
                status: client_1.QuoteStatus.SENT,
                project: { userId: 100 },
                phases: [{ id: 101 }]
            });
            setup_1.prismaMock.$transaction.mockImplementation((callback) => __awaiter(void 0, void 0, void 0, function* () { return yield callback(setup_1.prismaMock); }));
            yield quoteService_1.quoteService.acceptQuote(1, 100);
            const updateManyCallArgs = setup_1.prismaMock.contractorQuote.updateMany.mock.calls[0][0];
            // Verificăm că filterează strict pe faza 101
            expect((_d = (_c = (_b = (_a = updateManyCallArgs.where) === null || _a === void 0 ? void 0 : _a.phases) === null || _b === void 0 ? void 0 : _b.some) === null || _c === void 0 ? void 0 : _c.id) === null || _d === void 0 ? void 0 : _d.in).toContain(101);
        }));
    });
    describe('getQuotesForClient', () => {
        it('throws if project not found', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue(null);
            yield expect(quoteService_1.quoteService.getQuotesForClient(1, 100)).rejects.toThrow('Project not found');
        }));
        it('throws Unauthorized if project belongs to another user', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ userId: 99 });
            yield expect(quoteService_1.quoteService.getQuotesForClient(1, 100)).rejects.toThrow('Unauthorized');
        }));
        it('returns quotes for project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ userId: 100 });
            setup_1.prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const result = yield quoteService_1.quoteService.getQuotesForClient(1, 100);
            expect(result.length).toBe(2);
            expect(setup_1.prismaMock.contractorQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 1 } }));
        }));
    });
    describe('getQuotesForContractor', () => {
        it('throws if contractor profile not found', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue(null);
            yield expect(quoteService_1.quoteService.getQuotesForContractor(100)).rejects.toThrow('Contractor profile not found');
        }));
        it('returns quotes for contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 50 });
            setup_1.prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }]);
            const result = yield quoteService_1.quoteService.getQuotesForContractor(100);
            expect(result.length).toBe(1);
            expect(setup_1.prismaMock.contractorQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { contractorId: 50 } }));
        }));
    });
});
