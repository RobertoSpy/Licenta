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
exports.contractorService = void 0;
const prisma_1 = require("../../lib/prisma");
exports.contractorService = {
    getContractors(county, specializations) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereClause = {
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
            return prisma_1.prisma.contractorProfile.findMany({
                where: whereClause,
                include: {
                    user: { select: { name: true, email: true } },
                },
                orderBy: {
                    avgRating: 'desc',
                },
            });
        });
    },
    getContractorById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.contractorProfile.findUnique({
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
        });
    },
    updateProfile(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.contractorProfile.update({
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
        });
    },
    getProfileByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.contractorProfile.findUnique({
                where: { userId },
                include: {
                    user: { select: { name: true, email: true } }
                }
            });
        });
    },
    addReview(contractorId, reviewerId, rating, comment, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Verificăm dacă există o ofertă ACCEPTED între acest client și acest constructor pentru proiectul dat
            const quote = yield prisma_1.prisma.contractorQuote.findFirst({
                where: {
                    contractorId,
                    projectId,
                    project: {
                        userId: reviewerId
                    },
                    status: 'ACCEPTED'
                }
            });
            if (!quote) {
                throw new Error('NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE');
            }
            // 1.5. Verificam daca clientul a lasat deja o recenzie pentru acest proiect si constructor
            const existingReview = yield prisma_1.prisma.contractorReview.findFirst({
                where: { contractorId, projectId, reviewerId }
            });
            if (existingReview) {
                throw new Error('ALREADY_REVIEWED');
            }
            // 2. Cream recenzia
            const review = yield prisma_1.prisma.contractorReview.create({
                data: {
                    contractorId,
                    reviewerId,
                    projectId,
                    rating,
                    comment
                }
            });
            // 3. Recalculam media ratingului si numarul de proiecte
            const allReviews = yield prisma_1.prisma.contractorReview.findMany({
                where: { contractorId }
            });
            const rawAvg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
            const avgRating = Math.round(rawAvg * 100) / 100;
            yield prisma_1.prisma.contractorProfile.update({
                where: { id: contractorId },
                data: {
                    avgRating,
                    completedProjects: { increment: 1 } // un review implica terminarea proiectului, deci incrementam
                }
            });
            return review;
        });
    },
    /**
     * Returnează proiectele pentru care constructorul a câștigat oferta (status ACCEPTED).
     * userId = user-ul logat (CONTRACTOR)
     */
    getAcceptedProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Găsim profilul constructorului
            const profile = yield prisma_1.prisma.contractorProfile.findUnique({ where: { userId } });
            if (!profile)
                return [];
            const quotes = yield prisma_1.prisma.contractorQuote.findMany({
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
            return quotes.map(q => {
                var _a, _b, _c, _d;
                return ({
                    id: q.project.id,
                    name: (_a = q.project.title) !== null && _a !== void 0 ? _a : `Proiect #${q.project.id}`,
                    county: (_b = q.project.county) !== null && _b !== void 0 ? _b : null,
                    buildingPurpose: (_c = q.project.buildingPurpose) !== null && _c !== void 0 ? _c : null,
                    totalArea: (_d = q.project.totalArea) !== null && _d !== void 0 ? _d : null,
                    createdAt: q.project.createdAt,
                    user: q.project.user,
                    totalAmount: q.totalAmount
                });
            });
        });
    }
};
