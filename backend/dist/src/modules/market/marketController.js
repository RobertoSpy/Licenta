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
exports.getSummary = exports.getForecast = exports.getHistory = exports.rejectQuote = exports.acceptQuote = exports.getProjectQuotes = exports.submitQuote = exports.getFeed = exports.publishProject = void 0;
const prisma_1 = require("../../lib/prisma");
const marketService_1 = require("./marketService");
/**
 * Client: Publică proiectul pentru licitație (bidding)
 * POST /api/market/projects/:id/publish
 */
const publishProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = parseInt(req.params.id, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        const project = yield prisma_1.prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            res.status(404).json({ error: 'Proiectul nu a fost găsit' });
            return;
        }
        if (project.userId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(403).json({ error: 'Nu ești autorizat să publici acest proiect' });
            return;
        }
        const updatedProject = yield prisma_1.prisma.project.update({
            where: { id: projectId },
            data: { isPublishedForBidding: true }
        });
        res.json({ message: 'Proiectul a fost publicat cu succes în marketplace.', project: updatedProject });
    }
    catch (error) {
        console.error('[marketController.publishProject] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.publishProject = publishProject;
/**
 * Contractor: Vede feed-ul de proiecte disponibile
 * GET /api/market/projects/feed
 */
const getFeed = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            res.status(401).json({ error: 'Neautorizat' });
            return;
        }
        // Găsim profilul de contractor
        const contractor = yield prisma_1.prisma.contractorProfile.findUnique({
            where: { userId }
        });
        if (!contractor) {
            res.status(403).json({ error: 'Trebuie să fii înregistrat ca și constructor.' });
            return;
        }
        const projects = yield prisma_1.prisma.project.findMany({
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
            }
            else {
                // ascundem telefonul și limităm alte date
                return Object.assign(Object.assign({}, p), { user: {
                        name: p.user.name,
                        email: p.user.email,
                        phone: '*** (Cont Neverificat)'
                    } });
            }
        });
        res.json({ projects: sanitizedProjects, isVerified });
    }
    catch (error) {
        console.error('[marketController.getFeed] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.getFeed = getFeed;
/**
 * Contractor: Trimite o ofertă (Quote) pentru un proiect
 * POST /api/market/projects/:id/quotes
 */
const submitQuote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = parseInt(req.params.id, 10);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { totalAmount, executionDays, message, selectedPhases } = req.body;
        if (!userId || isNaN(projectId) || !selectedPhases || !Array.isArray(selectedPhases)) {
            res.status(400).json({ error: 'Date invalide' });
            return;
        }
        const contractor = yield prisma_1.prisma.contractorProfile.findUnique({
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
        const quote = yield prisma_1.prisma.contractorQuote.upsert({
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
                    set: selectedPhases.map((id) => ({ id }))
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
                    connect: selectedPhases.map((id) => ({ id }))
                }
            }
        });
        res.json({ message: 'Ofertă trimisă cu succes.', quote });
    }
    catch (error) {
        console.error('[marketController.submitQuote] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.submitQuote = submitQuote;
/**
 * Client: Vede ofertele primite pentru proiectul său
 * GET /api/market/projects/:id/quotes
 */
const getProjectQuotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = parseInt(req.params.id, 10);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId || isNaN(projectId)) {
            res.status(400).json({ error: 'Date invalide' });
            return;
        }
        const project = yield prisma_1.prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project || project.userId !== userId) {
            res.status(403).json({ error: 'Nu ai acces la acest proiect.' });
            return;
        }
        const quotes = yield prisma_1.prisma.contractorQuote.findMany({
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
    }
    catch (error) {
        console.error('[marketController.getProjectQuotes] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.getProjectQuotes = getProjectQuotes;
/**
 * Client: Acceptă o ofertă
 * POST /api/market/quotes/:quoteId/accept
 */
const acceptQuote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId || isNaN(quoteId)) {
            res.status(400).json({ error: 'Date invalide' });
            return;
        }
        const quote = yield prisma_1.prisma.contractorQuote.findUnique({
            where: { id: quoteId },
            include: { project: true, phases: true }
        });
        if (!quote || quote.project.userId !== userId) {
            res.status(403).json({ error: 'Acces interzis' });
            return;
        }
        // Acceptăm oferta curentă
        const acceptedQuote = yield prisma_1.prisma.contractorQuote.update({
            where: { id: quoteId },
            data: { status: 'ACCEPTED' }
        });
        // Actualizăm fazele selectate
        if (quote.phases && quote.phases.length > 0) {
            yield prisma_1.prisma.constructionPhase.updateMany({
                where: {
                    id: { in: quote.phases.map((p) => p.id) },
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
    }
    catch (error) {
        console.error('[marketController.acceptQuote] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.acceptQuote = acceptQuote;
/**
 * Client: Refuză o ofertă (cu mesaj opțional)
 * POST /api/market/quotes/:quoteId/reject
 */
const rejectQuote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { clientMessage } = req.body;
        if (!userId || isNaN(quoteId)) {
            res.status(400).json({ error: 'Date invalide' });
            return;
        }
        const quote = yield prisma_1.prisma.contractorQuote.findUnique({
            where: { id: quoteId },
            include: { project: true }
        });
        if (!quote || quote.project.userId !== userId) {
            res.status(403).json({ error: 'Acces interzis' });
            return;
        }
        yield prisma_1.prisma.contractorQuote.update({
            where: { id: quoteId },
            data: {
                status: 'REJECTED',
                clientMessage: clientMessage || null
            }
        });
        res.json({ message: 'Ofertă refuzată cu succes.' });
    }
    catch (error) {
        console.error('[marketController.rejectQuote] Eroare:', error);
        res.status(500).json({ error: 'Eroare internă de server' });
    }
});
exports.rejectQuote = rejectQuote;
/**
 * Returnează datele istorice INSSE CNS107D
 * GET /api/market/history
 */
const getHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield marketService_1.marketService.getIndexHistory();
        res.json({ data });
    }
    catch (error) {
        console.error('[marketController.getHistory] Eroare:', error);
        res.status(500).json({ error: 'Eroare la returnarea datelor istorice.' });
    }
});
exports.getHistory = getHistory;
/**
 * Returnează prognoza AI
 * GET /api/market/forecast
 */
const getForecast = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const forecast = yield marketService_1.marketService.getForecast();
        res.json(forecast);
    }
    catch (error) {
        console.error('[marketController.getForecast] Eroare:', error);
        res.status(500).json({ error: 'Eroare la generarea prognozei.' });
    }
});
exports.getForecast = getForecast;
/**
 * Returnează rezumatul pieței
 * GET /api/market/summary
 */
const getSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const summary = yield marketService_1.marketService.getSummary();
        res.json(summary);
    }
    catch (error) {
        console.error('[marketController.getSummary] Eroare:', error);
        res.status(500).json({ error: 'Eroare la generarea rezumatului.' });
    }
});
exports.getSummary = getSummary;
