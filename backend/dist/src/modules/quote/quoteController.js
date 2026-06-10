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
exports.acceptQuote = exports.submitQuote = exports.getContractorQuotes = exports.getClientQuotes = exports.requestQuotes = void 0;
const quoteService_1 = require("./quoteService");
const requestQuotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, contractorIds, message } = req.body;
        if (!projectId || !contractorIds || !Array.isArray(contractorIds)) {
            return res.status(400).json({ message: 'Date de intrare invalide: projectId și contractorIds sunt obligatorii' });
        }
        const result = yield quoteService_1.quoteService.requestQuotes(projectId, contractorIds, message);
        if (result.count > 0) {
            return res.status(201).json({ count: result.count, message: 'Cereri trimise cu succes.' });
        }
        else {
            return res.status(200).json(result);
        }
    }
    catch (error) {
        console.error('requestQuotes error:', error);
        if (error.message === 'Unauthorized')
            return res.status(403).json({ message: 'Acțiune nepermisă' });
        res.status(500).json({ message: 'Eroare la trimiterea cererii de ofertă' });
    }
});
exports.requestQuotes = requestQuotes;
const getClientQuotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;
        const quotes = yield quoteService_1.quoteService.getQuotesForClient(Number(projectId), userId);
        res.json(quotes);
    }
    catch (error) {
        console.error('getClientQuotes error:', error);
        if (error.message === 'Unauthorized')
            return res.status(403).json({ message: 'Proiectul nu vă aparține' });
        if (error.message.includes('not found'))
            return res.status(404).json({ message: 'Proiectul nu a fost găsit' });
        res.status(500).json({ message: 'Eroare la preluarea ofertelor' });
    }
});
exports.getClientQuotes = getClientQuotes;
const getContractorQuotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const quotes = yield quoteService_1.quoteService.getQuotesForContractor(userId);
        res.json(quotes);
    }
    catch (error) {
        console.error('getContractorQuotes error:', error);
        if (error.message.includes('not found'))
            return res.status(404).json({ message: 'Profilul de constructor nu a fost găsit' });
        res.status(500).json({ message: 'Eroare la preluarea lead-urilor' });
    }
});
exports.getContractorQuotes = getContractorQuotes;
const submitQuote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quoteId = req.params.id ? Number(req.params.id) : undefined;
        const userId = req.user.id;
        const result = yield quoteService_1.quoteService.submitQuote(quoteId, userId, req.body);
        res.json(result);
    }
    catch (error) {
        console.error('submitQuote error:', error);
        if (error.message.includes('Unauthorized'))
            return res.status(403).json({ message: 'Acțiune nepermisă' });
        if (error.message.includes('not found'))
            return res.status(404).json({ message: 'Profil sau ofertă inexistentă' });
        if (error.message.includes('Validation:'))
            return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'Eroare la trimiterea ofertei' });
    }
});
exports.submitQuote = submitQuote;
const acceptQuote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quoteId = Number(req.params.id);
        const userId = req.user.id;
        const result = yield quoteService_1.quoteService.acceptQuote(quoteId, userId);
        res.json(result);
    }
    catch (error) {
        console.error('acceptQuote error:', error);
        if (error.message.includes('Unauthorized'))
            return res.status(403).json({ message: 'Acțiune nepermisă' });
        if (error.message.includes('not found'))
            return res.status(404).json({ message: 'Oferta nu a fost găsită' });
        if (error.message.includes('Validation:'))
            return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'Eroare la acceptarea ofertei' });
    }
});
exports.acceptQuote = acceptQuote;
