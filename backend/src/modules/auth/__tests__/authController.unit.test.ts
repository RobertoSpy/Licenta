import { register, login, refresh, logout, forgotPassword, resetPassword, verifyEmail, resendVerification } from '../authController';
import { userRepository } from '../userRepository';
import * as emailService from '../emailService';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

jest.mock('../userRepository');
jest.mock('../emailService');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');

const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockEmail = emailService as jest.Mocked<typeof emailService>;

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
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development'; // pentru a testa secure cookies dacă e nevoie
  });

  describe('register', () => {
    it('returns 400 when email or password missing', async () => {
      const req: any = { body: {} };
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
      mockUserRepo.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockUserRepo.create.mockResolvedValue({ id: 2, email: 'a@b.com', name: 'X' } as any);
      mockUserRepo.saveVerificationToken.mockResolvedValue(undefined);
      mockEmail.sendVerificationEmail.mockResolvedValue(undefined);

      const req: any = { body: { email: 'a@b.com', password: 'Strong1!', name: 'X' } };
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns 401 for invalid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('login sets refreshToken in HttpOnly cookie and accessToken in JSON body', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: true, role: 'CLIENT', email: 'a@b.com', name: 'N' } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      
      mockUserRepo.updateRefreshToken.mockResolvedValue({} as any);

      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      
      await login(req, res);
      
      // AccessToken trebuie să fie doar în body!
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token' }));
      expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'refresh-token' }));

      // AccessToken trebuie să aibă 15m exp
      // AccessToken trebuie să aibă 15m exp
      expect((jwt.sign as jest.Mock).mock.calls[0][2]).toEqual(expect.objectContaining({ expiresIn: '15m' }));

      // RefreshToken trebuie să fie doar în cookie cu flags stricte
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'refresh-token', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 zile
      }));
    });

    it('login sets refreshToken cookie with Secure flag in production', async () => {
      process.env.NODE_ENV = 'production';
      
      mockUserRepo.findByEmail.mockResolvedValue({ id: 3, password: 'hash', isVerified: true, role: 'CLIENT' } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('token');
      mockUserRepo.updateRefreshToken.mockResolvedValue({} as any);

      const req: any = { body: { email: 'a@b.com', password: 'x' } };
      const res = mockRes();
      
      await login(req, res);
      
      expect(res.cookie).toHaveBeenCalledWith('jwt', expect.any(String), expect.objectContaining({
        secure: true
      }));
    });
  });

  describe('refresh & logout', () => {
    it('refresh with valid token returns new accessToken', async () => {
      const req: any = { cookies: { jwt: 'valid-refresh-token' } };
      const res = mockRes();
      
      // Decodificăm manual jwt.verify
      (jwt.verify as jest.Mock).mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
      // Token exists in DB => valid
      mockUserRepo.findByRefreshToken.mockResolvedValue({ id: 3, role: 'CLIENT' } as any);
      (jwt.sign as jest.Mock).mockReturnValue('new-access-token');

      await refresh(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access-token' }));
    });

    it('refresh with expired refreshToken returns 403', async () => {
      const req: any = { cookies: { jwt: 'expired-token' } };
      const res = mockRes();
      
      mockUserRepo.findByRefreshToken.mockResolvedValue({ id: 3, role: 'CLIENT' } as any);
      (jwt.verify as jest.Mock).mockImplementation((token, secret, cb) => cb(new Error('jwt expired'), null));

      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Acces interzis - Token manipulat sau expirat' });
    });

    it('refresh with refreshToken not matching DB returns 403 (token rotation attack prevention)', async () => {
      const req: any = { cookies: { jwt: 'stolen-valid-token' } };
      const res = mockRes();
      
      (jwt.verify as jest.Mock).mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
      
      mockUserRepo.findByRefreshToken.mockResolvedValue(null);

      await refresh(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Acces interzis - Token invalid pe server' });
    });

    it('refresh after logout (token invalidated in DB) returns 403', async () => {
      const req: any = { cookies: { jwt: 'stolen-token' } };
      const res = mockRes();
      
      (jwt.verify as jest.Mock).mockImplementation((token, secret, cb) => cb(null, { id: 3 }));
      mockUserRepo.findByRefreshToken.mockResolvedValue(null);
      
      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('logout clears refreshToken cookie (maxAge=0 or expires in past) and removes it from DB', async () => {
      const req: any = { cookies: { jwt: 'tok' } };
      const res = mockRes();
      mockUserRepo.clearRefreshToken.mockResolvedValue(undefined);
      
      await logout(req, res);
      
      expect(mockUserRepo.clearRefreshToken).toHaveBeenCalledWith('tok');
      expect(res.clearCookie).toHaveBeenCalledWith('jwt', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      }));
      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });
  });

  describe('forgotPassword (User enumeration prevention)', () => {
    it('forgot-password cu email inexistent returnează 200', async () => {
      // Nu returnăm 404 pentru a nu permite atacatorului să enumere emailurile din sistem
      mockUserRepo.findByEmail.mockResolvedValue(null);
      const req: any = { body: { email: 'x@y.com' } };
      const res = mockRes();
      
      await forgotPassword(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Dacă adresa există, vei primi un cod de verificare în câteva minute.' });
      expect(mockEmail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('forgot-password cu email valid returnează 200 și trimite email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: 10, email: 'x@y.com' } as any);
      mockUserRepo.saveResetToken.mockResolvedValue(undefined);
      mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);
      const req: any = { body: { email: 'x@y.com' } };
      const res = mockRes();
      
      await forgotPassword(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });
});
