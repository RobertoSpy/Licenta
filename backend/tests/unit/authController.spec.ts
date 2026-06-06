import crypto from 'crypto';
import { register, login, refresh, logout, forgotPassword, resetPassword, verifyEmail, resendVerification } from '../../../src/modules/auth/authController';
import { userRepository } from '../../../src/modules/auth/userRepository';
import * as emailService from '../../../src/modules/auth/emailService';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

jest.mock('../../../src/modules/auth/userRepository');
jest.mock('../../../src/modules/auth/emailService');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');

const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockEmail = emailService as jest.Mocked<typeof emailService>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('register', () => {
    it('returns 400 when email or password missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for weak password', async () => {
      const req: any = { body: { email: 'a@b.com', password: 'weak' } };
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 409 if user exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 1 } as any);
      const req: any = { body: { email: 'a@b.com', password: 'Strong1!' } };
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates user and sends verification email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null as any);
      mockedBcrypt.hash.mockResolvedValue('hashed');
      mockUserRepo.create.mockResolvedValue({ id: 2, email: 'a@b.com', name: 'X' } as any);
      mockUserRepo.saveVerificationToken.mockResolvedValue();
      mockEmail.sendVerificationEmail.mockResolvedValue();

      const req: any = { body: { email: 'a@b.com', password: 'Strong1!', name: 'X' } };
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('validates input and handles missing user', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 for invalid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null as any);
      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when password mismatch', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 1, password: 'hash' } as any);
      mockedBcrypt.compare.mockResolvedValue(false as any);
      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 403 when not verified', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 1, password: 'hash', isVerified: false } as any);
      mockedBcrypt.compare.mockResolvedValue(true as any);
      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('successful login sets cookies and returns tokens', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: true, role: 'user', email: 'a@b.com', name: 'N' } as any);
      mockedBcrypt.compare.mockResolvedValue(true as any);
      mockedJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockUserRepo.updateRefreshToken.mockResolvedValue({} as any);

      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      await login(req, res);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token' }));
    });
  });

  describe('refresh & logout', () => {
    it('refresh without cookie returns 401', async () => {
      const req: any = { cookies: {} };
      const res = mockRes();
      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('refresh with invalid token returns 403', async () => {
      const req: any = { cookies: { jwt: 'bad' } };
      mockUserRepo.findByRefreshToken.mockResolvedValue(null as any);
      const res = mockRes();
      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('logout clears cookie and returns 204', async () => {
      const req: any = { cookies: { jwt: 'tok' } };
      const res = mockRes();
      mockUserRepo.clearRefreshToken.mockResolvedValue();
      await logout(req, res);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('forgotPassword returns generic response when user missing', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null as any);
      const req: any = { body: { email: 'x@y.com' } };
      const res = mockRes();
      await forgotPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('forgotPassword sends email when user exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 10, email: 'x@y.com' } as any);
      mockUserRepo.saveResetToken.mockResolvedValue();
      mockEmail.sendPasswordResetEmail.mockResolvedValue();
      const req: any = { body: { email: 'x@y.com' } };
      const res = mockRes();
      await forgotPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('resetPassword fails on missing fields', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await resetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('resetPassword fails on invalid token', async () => {
      mockUserRepo.findByResetToken.mockResolvedValue(null as any);
      const req: any = { body: { email: 'a@b.com', otp: '123456', newPassword: 'Strong1!' } };
      const res = mockRes();
      await resetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('resetPassword success updates password', async () => {
      mockUserRepo.findByResetToken.mockResolvedValue({ id: 11, email: 'a@b.com' } as any);
      mockedBcrypt.hash.mockResolvedValue('newhashed');
      mockUserRepo.clearResetToken.mockResolvedValue();
      const req: any = { body: { email: 'a@b.com', otp: '123456', newPassword: 'Strong1!' } };
      const res = mockRes();
      await resetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('verifyEmail & resendVerification', () => {
    it('verifyEmail fails on missing fields', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('verifyEmail fails on invalid token', async () => {
      mockUserRepo.findByVerificationToken.mockResolvedValue(null as any);
      const req: any = { body: { email: 'a@b.com', otp: '123456' } };
      const res = mockRes();
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('verifyEmail success sets cookies and returns tokens', async () => {
      mockUserRepo.findByVerificationToken.mockResolvedValue({ id: 20, email: 'a@b.com', name: 'N', role: 'user' } as any);
      mockUserRepo.markAsVerified.mockResolvedValue();
      mockedJwt.sign.mockReturnValueOnce('access').mockReturnValueOnce('refresh');
      mockUserRepo.updateRefreshToken.mockResolvedValue();

      const req: any = { body: { email: 'a@b.com', otp: '123456' } };
      const res = mockRes();
      await verifyEmail(req, res);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('resendVerification returns 200 when user missing', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null as any);
      const req: any = { body: { email: 'a@b.com' } };
      const res = mockRes();
      await resendVerification(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('resendVerification returns 400 when already verified', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ isVerified: true } as any);
      const req: any = { body: { email: 'a@b.com' } };
      const res = mockRes();
      await resendVerification(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('resendVerification sends email when applicable', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 30, isVerified: false, email: 'a@b.com' } as any);
      mockUserRepo.saveVerificationToken.mockResolvedValue();
      mockEmail.sendVerificationEmail.mockResolvedValue();
      const req: any = { body: { email: 'a@b.com' } };
      const res = mockRes();
      await resendVerification(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalled();
    });
  });
});
