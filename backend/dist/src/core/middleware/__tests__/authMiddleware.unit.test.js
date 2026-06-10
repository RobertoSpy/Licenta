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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authMiddleware_1 = require("../authMiddleware");
const setup_1 = require("../../../../tests/setup");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
jest.mock('jsonwebtoken');
describe('authMiddleware (unit)', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });
    it('returns 401 when Authorization header exists but token is malformed (not JWT format)', () => __awaiter(void 0, void 0, void 0, function* () {
        req.headers.authorization = 'Bearer malformed_token_string';
        jsonwebtoken_1.default.verify.mockImplementation(() => {
            throw new Error('jwt malformed');
        });
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Neautorizat, token invalid' });
        expect(next).not.toHaveBeenCalled();
    }));
    it('returns 401 when token signature is valid but userId does not exist in DB', () => __awaiter(void 0, void 0, void 0, function* () {
        req.headers.authorization = 'Bearer valid_token';
        jsonwebtoken_1.default.verify.mockReturnValue({ id: 999 });
        setup_1.prismaMock.user.findUnique.mockResolvedValue(null);
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Neautorizat, utilizatorul nu mai există' });
        expect(next).not.toHaveBeenCalled();
    }));
    it('returns 401 when token is valid but user has been deactivated/deleted since issue', () => __awaiter(void 0, void 0, void 0, function* () {
        // Același comportament: user-ul nu mai este în baza de date.
        req.headers.authorization = 'Bearer valid_token';
        jsonwebtoken_1.default.verify.mockReturnValue({ id: 1 });
        setup_1.prismaMock.user.findUnique.mockResolvedValue(null);
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    }));
    it('does not call next() on any 401 path', () => __awaiter(void 0, void 0, void 0, function* () {
        req.headers.authorization = undefined; // No token
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    }));
    it('calls next() exactly once on success, not twice', () => __awaiter(void 0, void 0, void 0, function* () {
        req.headers.authorization = 'Bearer valid_token';
        jsonwebtoken_1.default.verify.mockReturnValue({ id: 1 });
        setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 1, role: client_1.UserRole.CLIENT, email: 'test@test.com' });
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    }));
    it('sets req.user with id, email, role — not full user object with password hash', () => __awaiter(void 0, void 0, void 0, function* () {
        req.headers.authorization = 'Bearer valid_token';
        jsonwebtoken_1.default.verify.mockReturnValue({ id: 1 });
        // Simulăm ce returnează Prisma prin select-ul restrâns
        const selectedData = { id: 1, role: client_1.UserRole.CLIENT, email: 'test@test.com' };
        setup_1.prismaMock.user.findUnique.mockResolvedValue(selectedData);
        yield (0, authMiddleware_1.protect)(req, res, next);
        expect(req.user).toEqual(selectedData);
        expect(req.user.passwordHash).toBeUndefined(); // Nu vrem expunerea parolei!
        expect(next).toHaveBeenCalled();
    }));
});
