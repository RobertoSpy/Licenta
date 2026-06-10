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
const emailService_1 = require("../emailService");
const resend_1 = require("resend");
jest.mock('resend');
describe('emailService', () => {
    const originalEnv = process.env;
    let mockSend;
    beforeEach(() => {
        jest.resetModules();
        process.env = Object.assign(Object.assign({}, originalEnv), { RESEND_API_KEY: 'test_key', FROM_EMAIL: 'test@zidario.ro' });
        mockSend = jest.fn().mockResolvedValue({ id: 'mocked_email_id' });
        resend_1.Resend.mockImplementation(() => ({
            emails: {
                send: mockSend,
            },
        }));
    });
    afterAll(() => {
        process.env = originalEnv;
    });
    it('throws error if RESEND_API_KEY is missing', () => __awaiter(void 0, void 0, void 0, function* () {
        delete process.env.RESEND_API_KEY;
        yield expect((0, emailService_1.sendVerificationEmail)('test@example.com', '123456')).rejects.toThrow('RESEND_API_KEY lipsește din variabilele de mediu.');
    }));
    it('sendPasswordResetEmail calls resend with correct parameters', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, emailService_1.sendPasswordResetEmail)('user@test.com', '987654');
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user@test.com',
            from: 'Zidario <test@zidario.ro>',
            subject: 'Codul tău de resetare parolă — Zidario',
            html: expect.stringContaining('987654'),
        }));
    }));
    it('sendVerificationEmail calls resend with correct parameters', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, emailService_1.sendVerificationEmail)('newuser@test.com', '112233');
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            to: 'newuser@test.com',
            from: 'Zidario <test@zidario.ro>',
            subject: 'Codul tău de verificare cont — Zidario',
            html: expect.stringContaining('112233'),
        }));
    }));
});
