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
exports.userRepository = void 0;
const prisma_1 = require("../../lib/prisma");
exports.userRepository = {
    findByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.findUnique({ where: { email } });
        });
    },
    findByRefreshToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.findFirst({ where: { refreshToken } });
        });
    },
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.create({ data });
        });
    },
    updateRefreshToken(id, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.update({
                where: { id },
                data: { refreshToken }
            });
        });
    },
    clearRefreshToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.user.updateMany({
                where: { refreshToken },
                data: { refreshToken: null }
            });
        });
    },
    saveResetToken(userId, hashedToken, expires) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    passwordResetToken: hashedToken,
                    passwordResetExpires: expires,
                },
            });
        });
    },
    findByResetToken(hashedToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.findFirst({
                where: {
                    passwordResetToken: hashedToken,
                    passwordResetExpires: { gt: new Date() }, // token-ul nu a expirat
                },
            });
        });
    },
    clearResetToken(userId, newHashedPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    password: newHashedPassword,
                    passwordResetToken: null,
                    passwordResetExpires: null,
                },
            });
        });
    },
    saveVerificationToken(userId, hashedToken, expires) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    verificationToken: hashedToken,
                    verificationExpires: expires,
                },
            });
        });
    },
    findByVerificationToken(hashedToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.findFirst({
                where: {
                    verificationToken: hashedToken,
                    verificationExpires: { gt: new Date() },
                },
            });
        });
    },
    markAsVerified(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    isVerified: true,
                    verificationToken: null,
                    verificationExpires: null,
                },
            });
        });
    },
};
