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
const userRepository_1 = require("../userRepository");
const prisma_1 = require("../../../lib/prisma");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
    },
}));
describe('userRepository', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('findByEmail returns user', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockUser = { id: 1, email: 'test@test.com' };
        prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
        const result = yield userRepository_1.userRepository.findByEmail('test@test.com');
        expect(result).toEqual(mockUser);
        expect(prisma_1.prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    }));
    it('findByRefreshToken returns user', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockUser = { id: 1, refreshToken: 'token123' };
        prisma_1.prisma.user.findFirst.mockResolvedValue(mockUser);
        const result = yield userRepository_1.userRepository.findByRefreshToken('token123');
        expect(result).toEqual(mockUser);
        expect(prisma_1.prisma.user.findFirst).toHaveBeenCalledWith({ where: { refreshToken: 'token123' } });
    }));
    it('create user', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockData = { email: 'new@test.com', password: 'hash', name: 'John' };
        const mockUser = Object.assign({ id: 2 }, mockData);
        prisma_1.prisma.user.create.mockResolvedValue(mockUser);
        const result = yield userRepository_1.userRepository.create(mockData);
        expect(result).toEqual(mockUser);
        expect(prisma_1.prisma.user.create).toHaveBeenCalledWith({ data: mockData });
    }));
    it('updateRefreshToken updates the token', () => __awaiter(void 0, void 0, void 0, function* () {
        prisma_1.prisma.user.update.mockResolvedValue({ id: 1 });
        yield userRepository_1.userRepository.updateRefreshToken(1, 'newtoken');
        expect(prisma_1.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { refreshToken: 'newtoken' }
        });
    }));
    it('clearRefreshToken clears tokens globally by string', () => __awaiter(void 0, void 0, void 0, function* () {
        prisma_1.prisma.user.updateMany.mockResolvedValue({ count: 1 });
        yield userRepository_1.userRepository.clearRefreshToken('oldtoken');
        expect(prisma_1.prisma.user.updateMany).toHaveBeenCalledWith({
            where: { refreshToken: 'oldtoken' },
            data: { refreshToken: null }
        });
    }));
    it('saveResetToken updates token and expiry', () => __awaiter(void 0, void 0, void 0, function* () {
        const expires = new Date();
        yield userRepository_1.userRepository.saveResetToken(1, 'hashedReset', expires);
        expect(prisma_1.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { passwordResetToken: 'hashedReset', passwordResetExpires: expires }
        });
    }));
    it('findByResetToken checks for token and expiry', () => __awaiter(void 0, void 0, void 0, function* () {
        yield userRepository_1.userRepository.findByResetToken('hashedReset');
        expect(prisma_1.prisma.user.findFirst).toHaveBeenCalledWith({
            where: {
                passwordResetToken: 'hashedReset',
                passwordResetExpires: { gt: expect.any(Date) }
            }
        });
    }));
    it('clearResetToken updates password and clears tokens', () => __awaiter(void 0, void 0, void 0, function* () {
        yield userRepository_1.userRepository.clearResetToken(1, 'newHashedPass');
        expect(prisma_1.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                password: 'newHashedPass',
                passwordResetToken: null,
                passwordResetExpires: null,
            }
        });
    }));
    it('saveVerificationToken updates verification token and expiry', () => __awaiter(void 0, void 0, void 0, function* () {
        const expires = new Date();
        yield userRepository_1.userRepository.saveVerificationToken(1, 'verifHash', expires);
        expect(prisma_1.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { verificationToken: 'verifHash', verificationExpires: expires }
        });
    }));
    it('findByVerificationToken checks for token and expiry', () => __awaiter(void 0, void 0, void 0, function* () {
        yield userRepository_1.userRepository.findByVerificationToken('verifHash');
        expect(prisma_1.prisma.user.findFirst).toHaveBeenCalledWith({
            where: {
                verificationToken: 'verifHash',
                verificationExpires: { gt: expect.any(Date) }
            }
        });
    }));
    it('markAsVerified sets isVerified to true and clears tokens', () => __awaiter(void 0, void 0, void 0, function* () {
        yield userRepository_1.userRepository.markAsVerified(1);
        expect(prisma_1.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationExpires: null,
            }
        });
    }));
});
