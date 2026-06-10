"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authController_1 = require("../authController");
const userRepository_1 = require("../userRepository");
const emailService = __importStar(require("../emailService"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
jest.mock('../userRepository');
jest.mock('../emailService');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
const mockUserRepo = userRepository_1.userRepository;
const mockEmail = emailService;
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.sendStatus = jest.fn().mockReturnValue(res);
    return res;
}
describe('authController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'development'; // pentru a testa secure cookies dacă e nevoie
    });
    describe('register', () => {
        it('returns 400 when email or password missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, authController_1.register)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 409 if user exists', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue({ id: 1 });
            const req = { body: { email: 'a@b.com', password: 'Strong1!' } };
            const res = mockRes();
            yield (0, authController_1.register)(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        }));
        it('creates user and sends verification email', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue(null);
            bcrypt_1.default.hash.mockResolvedValue('hashed');
            mockUserRepo.create.mockResolvedValue({ id: 2, email: 'a@b.com', name: 'X' });
            mockUserRepo.saveVerificationToken.mockResolvedValue(undefined);
            mockEmail.sendVerificationEmail.mockResolvedValue(undefined);
            const req = { body: { email: 'a@b.com', password: 'Strong1!', name: 'X' } };
            const res = mockRes();
            yield (0, authController_1.register)(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(mockEmail.sendVerificationEmail).toHaveBeenCalled();
        }));
        it('returns 400 when password is weak', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { email: 'a@b.com', password: 'weak', name: 'X' } };
            const res = mockRes();
            yield (0, authController_1.register)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('suficient de puternică') }));
        }));
    });
    describe('registerContractor', () => {
        it('returns 400 when essential fields are missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { email: 'c@d.com', password: 'StrongPassword1!' } }; // lipsesc companyName, etc
            const res = mockRes();
            yield (0, authController_1.registerContractor)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 when password is weak', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { email: 'c@d.com', password: 'weak', companyName: 'SRL', cui: '123', county: 'B' } };
            const res = mockRes();
            yield (0, authController_1.registerContractor)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 409 if user exists', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue({ id: 1 });
            const req = { body: { email: 'c@d.com', password: 'StrongPassword1!', companyName: 'SRL', cui: '123', county: 'B' } };
            const res = mockRes();
            yield (0, authController_1.registerContractor)(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        }));
    });
    describe('login', () => {
        it('returns 401 for invalid credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue(null);
            const req = { body: { email: 'a@b.com', password: 'x' } };
            const res = mockRes();
            yield (0, authController_1.login)(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        }));
        it('login sets refreshToken in HttpOnly cookie and accessToken in JSON body', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: true, role: 'CLIENT', email: 'a@b.com', name: 'N' });
            bcrypt_1.default.compare.mockResolvedValue(true);
            jsonwebtoken_1.default.sign
                .mockReturnValueOnce('access-token')
                .mockReturnValueOnce('refresh-token');
            mockUserRepo.updateRefreshToken.mockResolvedValue({});
            const req = { body: { email: 'a@b.com', password: 'x' } };
            const res = mockRes();
            yield (0, authController_1.login)(req, res);
            // AccessToken trebuie să fie doar în body!
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token' }));
            expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'refresh-token' }));
            // AccessToken trebuie să aibă 15m exp
            // AccessToken trebuie să aibă 15m exp
            expect(jsonwebtoken_1.default.sign.mock.calls[0][2]).toEqual(expect.objectContaining({ expiresIn: '15m' }));
            // RefreshToken trebuie să fie doar în cookie cu flags stricte
            expect(res.cookie).toHaveBeenCalledWith('jwt', 'refresh-token', expect.objectContaining({
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 zile
            }));
        }));
        it('login sets refreshToken cookie with Secure flag in production', () => __awaiter(void 0, void 0, void 0, function* () {
            process.env.NODE_ENV = 'production';
            mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: true, role: 'CLIENT' });
            bcrypt_1.default.compare.mockResolvedValue(true);
            jsonwebtoken_1.default.sign.mockReturnValue('token');
            mockUserRepo.updateRefreshToken.mockResolvedValue({});
            const req = { body: { email: 'a@b.com', password: 'x' } };
            const res = mockRes();
            yield (0, authController_1.login)(req, res);
            expect(res.cookie).toHaveBeenCalledWith('jwt', expect.any(String), expect.objectContaining({
                secure: true
            }));
        }));
        it('returns 403 if user is not verified', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: false, email: 'a@b.com' });
            bcrypt_1.default.compare.mockResolvedValue(true);
            const req = { body: { email: 'a@b.com', password: 'x' } };
            const res = mockRes();
            yield (0, authController_1.login)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Contul nu este verificat. Introdu codul trimis pe email.' });
        }));
    });
    describe('refresh & logout', () => {
        it('refresh with valid token returns new accessToken', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { cookies: { jwt: 'valid-refresh-token' } };
            const res = mockRes();
            // Decodificăm manual jwt.verify
            jsonwebtoken_1.default.verify.mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
            // Token exists in DB => valid
            mockUserRepo.findByRefreshToken.mockResolvedValue({ id: 3, role: 'CLIENT' });
            jsonwebtoken_1.default.sign.mockReturnValue('new-access-token');
            yield (0, authController_1.refresh)(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access-token' }));
        }));
        it('refresh with expired refreshToken returns 403', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { cookies: { jwt: 'expired-token' } };
            const res = mockRes();
            mockUserRepo.findByRefreshToken.mockResolvedValue({ id: 3, role: 'CLIENT' });
            jsonwebtoken_1.default.verify.mockImplementation((token, secret, cb) => cb(new Error('jwt expired'), null));
            yield (0, authController_1.refresh)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Acces interzis - Token manipulat sau expirat' });
        }));
        it('refresh with refreshToken not matching DB returns 403 (token rotation attack prevention)', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { cookies: { jwt: 'stolen-valid-token' } };
            const res = mockRes();
            jsonwebtoken_1.default.verify.mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
            mockUserRepo.findByRefreshToken.mockResolvedValue(null);
            yield (0, authController_1.refresh)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Acces interzis - Token invalid pe server' });
        }));
        it('refresh after logout (token invalidated in DB) returns 403', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { cookies: { jwt: 'stolen-token' } };
            const res = mockRes();
            jsonwebtoken_1.default.verify.mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
            mockUserRepo.findByRefreshToken.mockResolvedValue(null);
            yield (0, authController_1.refresh)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('logout clears refreshToken cookie (maxAge=0 or expires in past) and removes it from DB', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { cookies: { jwt: 'tok' } };
            const res = mockRes();
            mockUserRepo.clearRefreshToken.mockResolvedValue(undefined);
            yield (0, authController_1.logout)(req, res);
            expect(mockUserRepo.clearRefreshToken).toHaveBeenCalledWith('tok');
            expect(res.clearCookie).toHaveBeenCalledWith('jwt', expect.objectContaining({
                httpOnly: true,
                sameSite: 'strict',
            }));
            expect(res.sendStatus).toHaveBeenCalledWith(204);
        }));
    });
    describe('forgotPassword (User enumeration prevention)', () => {
        it('forgot-password cu email inexistent returnează 200', () => __awaiter(void 0, void 0, void 0, function* () {
            // Nu returnăm 404 pentru a nu permite atacatorului să enumere emailurile din sistem
            mockUserRepo.findByEmail.mockResolvedValue(null);
            const req = { body: { email: 'x@y.com' } };
            const res = mockRes();
            yield (0, authController_1.forgotPassword)(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Dacă adresa există, vei primi un cod de verificare în câteva minute.' });
            expect(mockEmail.sendPasswordResetEmail).not.toHaveBeenCalled();
        }));
        it('forgot-password cu email valid returnează 200 și trimite email', () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepo.findByEmail.mockResolvedValue({ id: 10, email: 'x@y.com' });
            mockUserRepo.saveResetToken.mockResolvedValue(undefined);
            mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);
            const req = { body: { email: 'x@y.com' } };
            const res = mockRes();
            yield (0, authController_1.forgotPassword)(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalled();
        }));
    });
    describe('deleteAccount', () => {
        it('returns 400 if password is not provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { user: { id: 1 }, body: {} };
            const res = mockRes();
            const { deleteAccount } = require('../authController');
            yield deleteAccount(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
    });
    describe('verifyEmail', () => {
        it('returns 400 if email or otp is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, authController_1.verifyEmail)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
    });
});
