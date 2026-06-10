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
exports.quoteService = void 0;
const prisma_1 = require("../../lib/prisma");
const client_1 = require("@prisma/client");
const mapPhaseToSpecializations = (phaseName) => {
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
};
exports.quoteService = {
    requestQuotes(projectId, contractorIds, message, phaseIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const project = yield prisma_1.prisma.project.findUnique({
                where: { id: projectId },
                include: { constructionPhases: true }
            });
            if (!project)
                throw new Error('Project not found');
            const contractors = yield prisma_1.prisma.contractorProfile.findMany({
                where: { id: { in: contractorIds } }
            });
            let quotesCreated = 0;
            for (const contractor of contractors) {
                // Filtrăm etapele dacă utilizatorul a selectat etape specifice
                const phasesToProcess = phaseIds
                    ? project.constructionPhases.filter(p => phaseIds.includes(p.id))
                    : project.constructionPhases;
                for (const phase of phasesToProcess) {
                    const allowedSpecs = mapPhaseToSpecializations(phase.name);
                    const canBid = contractor.specializations.some(spec => allowedSpecs.includes(spec));
                    if (canBid) {
                        // Creem oferta doar dacă nu există deja pentru această fază
                        const existingQuote = yield prisma_1.prisma.contractorQuote.findUnique({
                            where: {
                                contractorId_projectId: {
                                    contractorId: contractor.id,
                                    projectId: projectId
                                }
                            },
                            include: { phases: true }
                        });
                        if (!existingQuote) {
                            yield prisma_1.prisma.contractorQuote.create({
                                data: {
                                    projectId,
                                    contractorId: contractor.id,
                                    message,
                                    status: client_1.QuoteStatus.PENDING,
                                    phases: { connect: [{ id: phase.id }] }
                                }
                            });
                            quotesCreated++;
                        }
                        else {
                            if (!existingQuote.phases.find(p => p.id === phase.id)) {
                                yield prisma_1.prisma.contractorQuote.update({
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
        });
    },
    getQuotesForClient(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const project = yield prisma_1.prisma.project.findUnique({ where: { id: projectId } });
            if (!project)
                throw new Error('Project not found');
            if (project.userId !== userId) {
                throw new Error('Unauthorized');
            }
            return prisma_1.prisma.contractorQuote.findMany({
                where: { projectId },
                include: {
                    contractor: {
                        include: { user: { select: { name: true, email: true, phone: true } } }
                    },
                    phases: true
                },
                orderBy: { updatedAt: 'desc' }
            });
        });
    },
    getQuotesForContractor(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const profile = yield prisma_1.prisma.contractorProfile.findUnique({ where: { userId } });
            if (!profile)
                throw new Error('Contractor profile not found');
            return prisma_1.prisma.contractorQuote.findMany({
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
        });
    },
    submitQuote(quoteId, contractorUserId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.totalAmount === undefined || data.totalAmount <= 0) {
                throw new Error('Validation: totalAmount trebuie să fie un număr pozitiv mai mare ca 0');
            }
            const profile = yield prisma_1.prisma.contractorProfile.findUnique({ where: { userId: contractorUserId } });
            if (!profile)
                throw new Error('Contractor profile not found');
            let quote;
            if (data.selfInitiated) {
                if (!data.projectId || !data.selectedPhases || data.selectedPhases.length === 0) {
                    throw new Error('Validation: projectId și selectedPhases sunt necesare pentru oferte inițiate de constructor');
                }
                const phases = yield prisma_1.prisma.constructionPhase.findMany({ where: { id: { in: data.selectedPhases } } });
                if (!phases || phases.length !== data.selectedPhases.length)
                    throw new Error('Validation: Unele faze nu există');
                // Validează specializarea pentru fiecare fază (sau măcar pe una din ele)
                for (const phase of phases) {
                    const allowedSpecs = mapPhaseToSpecializations(phase.name);
                    const canBid = profile.specializations.some(spec => allowedSpecs.includes(spec));
                    if (!canBid) {
                        throw new Error('Validation: Specializarea dumneavoastră nu vă permite să licitați pe etapa ' + phase.name);
                    }
                }
                quote = yield prisma_1.prisma.contractorQuote.upsert({
                    where: {
                        contractorId_projectId: {
                            contractorId: profile.id,
                            projectId: data.projectId
                        }
                    },
                    update: {
                        status: client_1.QuoteStatus.SENT,
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
                        status: client_1.QuoteStatus.SENT,
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
            quote = yield prisma_1.prisma.contractorQuote.findUnique({ where: { id: quoteId } });
            if (!quote)
                throw new Error('Quote not found');
            if (quote.contractorId !== profile.id) {
                throw new Error('Unauthorized');
            }
            if (quote.status === client_1.QuoteStatus.ACCEPTED) {
                throw new Error('Validation: Nu se poate retrimite o ofertă deja acceptată');
            }
            return prisma_1.prisma.contractorQuote.update({
                where: { id: quoteId },
                data: {
                    status: client_1.QuoteStatus.SENT,
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
        });
    },
    acceptQuote(quoteId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const quote = yield prisma_1.prisma.contractorQuote.findUnique({
                where: { id: quoteId },
                include: { project: true, phases: true }
            });
            if (!quote)
                throw new Error('Quote not found');
            if (quote.project.userId !== userId) {
                throw new Error('Unauthorized');
            }
            if (quote.status === client_1.QuoteStatus.ACCEPTED) {
                return quote;
            }
            return prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const acceptedQuote = yield tx.contractorQuote.update({
                    where: { id: quoteId },
                    data: { status: client_1.QuoteStatus.ACCEPTED }
                });
                if (quote.phases.length > 0) {
                    yield tx.constructionPhase.updateMany({
                        where: { id: { in: quote.phases.map(p => p.id) } },
                        data: {
                            contractorId: acceptedQuote.contractorId,
                            quoteId: acceptedQuote.id
                        }
                    });
                    // Respingem celelalte oferte pentru aceste faze
                    yield tx.contractorQuote.updateMany({
                        where: {
                            id: { not: quoteId },
                            phases: { some: { id: { in: quote.phases.map(p => p.id) } } },
                            status: { in: [client_1.QuoteStatus.PENDING, client_1.QuoteStatus.SENT, client_1.QuoteStatus.NEGOTIATING] }
                        },
                        data: {
                            status: client_1.QuoteStatus.REJECTED,
                            clientMessage: 'Etapele au fost atribuite altei firme.'
                        }
                    });
                }
                return acceptedQuote;
            }));
        });
    }
};
