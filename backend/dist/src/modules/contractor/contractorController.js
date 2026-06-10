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
exports.getAcceptedProjects = exports.addReview = exports.updateMyProfile = exports.getMyProfile = exports.getContractorById = exports.getContractors = void 0;
const contractorService_1 = require("./contractorService");
const getContractors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { county, specializations } = req.query;
        const specArray = specializations ? specializations.split(',') : undefined;
        const contractors = yield contractorService_1.contractorService.getContractors(county, specArray);
        res.json(contractors);
    }
    catch (error) {
        console.error('getContractors error:', error);
        res.status(500).json({ message: 'Eroare la preluarea constructorilor' });
    }
});
exports.getContractors = getContractors;
const getContractorById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const contractorId = parseInt(req.params.id);
        if (isNaN(contractorId)) {
            return res.status(400).json({ message: 'ID constructor invalid' });
        }
        const contractor = yield contractorService_1.contractorService.getContractorById(contractorId);
        if (!contractor) {
            return res.status(404).json({ message: 'Constructorul nu a fost găsit' });
        }
        res.json(contractor);
    }
    catch (error) {
        console.error('getContractorById error:', error);
        res.status(500).json({ message: 'Eroare la preluarea constructorului' });
    }
});
exports.getContractorById = getContractorById;
const getMyProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const profile = yield contractorService_1.contractorService.getProfileByUserId(userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profilul nu a fost găsit' });
        }
        res.json(profile);
    }
    catch (error) {
        console.error('getMyProfile error:', error);
        res.status(500).json({ message: 'Eroare la preluarea profilului' });
    }
});
exports.getMyProfile = getMyProfile;
const updateMyProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const profile = yield contractorService_1.contractorService.updateProfile(userId, req.body);
        res.json(profile);
    }
    catch (error) {
        console.error('updateMyProfile error:', error);
        res.status(500).json({ message: 'Eroare la actualizarea profilului' });
    }
});
exports.updateMyProfile = updateMyProfile;
const addReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reviewerId = req.user.id;
        const contractorId = parseInt(req.params.id);
        if (isNaN(contractorId)) {
            return res.status(400).json({ message: 'ID constructor invalid' });
        }
        const { rating, comment, projectId } = req.body;
        if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating invalid' });
        }
        if (!comment || typeof comment !== 'string' || comment.trim().length === 0 || comment.length > 1000) {
            return res.status(400).json({ message: 'Comentariu invalid' });
        }
        const parsedProjectId = parseInt(projectId);
        if (isNaN(parsedProjectId)) {
            return res.status(400).json({ message: 'Proiectul trebuie specificat' });
        }
        const review = yield contractorService_1.contractorService.addReview(contractorId, reviewerId, rating, comment, parsedProjectId);
        res.json({ success: true, review });
    }
    catch (error) {
        console.error('addReview error:', error);
        if (error.message === 'NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE') {
            return res.status(403).json({ message: 'Nu poți lăsa o recenzie fără un contract acceptat pe acest proiect.' });
        }
        if (error.message === 'ALREADY_REVIEWED') {
            return res.status(409).json({ message: 'Ai lăsat deja o recenzie pentru acest proiect.' });
        }
        res.status(500).json({ message: 'Eroare la adăugarea recenziei' });
    }
});
exports.addReview = addReview;
const getAcceptedProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const projects = yield contractorService_1.contractorService.getAcceptedProjects(userId);
        res.json(projects);
    }
    catch (error) {
        console.error('getAcceptedProjects error:', error);
        res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
    }
});
exports.getAcceptedProjects = getAcceptedProjects;
